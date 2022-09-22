# ----- IMPORTS and STUFFS -------------------------------------------------------
from re import sub
from sklearn.metrics import *
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage
import pandas as pd
import os
import datetime
import math
from math import *
import urllib.request
import collections
from pypandoc.pandoc_download import download_pandoc
import pypandoc
import random
import numpy as np
from retrying import retry
import requests
import shutil
import time
import json

from MCC_Weighted.weighted_metrics import Weighted_metrics

# ----- FIREBASE APP CONFIGURATION -----------------------------------------------------

# Initialize firebase app.
# The firebase private key is provided by firebase and contains the credentials to link the backend server
# to the firebase environment.
cred = credentials.Certificate("firebase_private_key/firebase-adminsdk.json")
secrets = pd.read_csv('firebase_private_key/secrets.csv')
firebase_admin.initialize_app(cred)

# Create references to the firebase database and to the firebase storage
db = firestore.client()
bucket = storage.bucket()

# the "@retry" decorator on the following functions describe their behaviour
# when a function call is unsuccessful by allowing the server to retry
# the failed call for a number of time.

# ----- WRITE - USER DATA TO DATABASE -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def create_new_user(uid,email):
    db.collection(u'users').document(u'%s' % uid).set({'profile':{'badge':'Novice','email':email,'reputation':'0'}})
    return {0:True}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def update_profile(uid,user_dict):
    ''' Updates user profile identified by its userID (uid) with the data provided in
        a dictionary (user_dict).
        Do check for field integrity and correct format.
        Also update search_archive/archive.csv that contains the data used by the
        frontend search bar.

        return the updated profiles, eventually with a list of invalid fields.
        print an error in the server log when an error occurs.
    '''
    try:
        invalid_fields = []
        if 'qualifications' in user_dict:
            if len(user_dict['qualifications']) > 500:
                invalid_fields.append('Qalifications: max 500 characters')
                del user_dict['qualifications']
        if 'name' in user_dict:
            if len(user_dict['name']) < 2:
                invalid_fields.append('Name: min 2 characters, no special characters allowed')
                del user_dict['name']
        if 'surname' in user_dict:
            if len(user_dict['surname']) < 2:
                invalid_fields.append('Surname: min 2 characters, no special characters allowed')
                del user_dict['surname']
        if 'phone' in user_dict:
            if len(user_dict['phone']) > 14:
                invalid_fields.append('Phone: max 14 characters')
                del user_dict['phone']
        if 'phrase' in user_dict:
            if len(user_dict['phrase']) > 40:
                invalid_fields.append('Phrase: max 40 characters')
                del user_dict['phrase']
        if 'public_email' in user_dict:
            if '@' not in user_dict['public_email'] or '.' not in user_dict['public_email'][user_dict['public_email'].find('@'):] or len(user_dict['public_email']) > 40 or len(user_dict['public_email']) < 5:
                invalid_fields.append('Invalid Email Address')
                del user_dict['public_email']
        profile = db.collection(u'users').document(u'%s' % uid)
        if user_dict != {}:
            profile.set({'profile':user_dict},merge=True)
        profile = profile.get()
        profile = profile.to_dict()
        fullName = profile['profile']['name'] + ' ' + profile['profile']['surname']
        img = '999'
        if 'img' in profile['profile']:
            img = profile['profile']['img']
        df = pd.read_csv('search_archive/archive.csv')
        if df.loc[df['ID']==uid].count()[0] > 0:
            index = df.loc[df['ID']==uid].index[0]
            amend_archive({'ID':[uid],'KIND':['user'],'VALUE':[fullName],'IMG':[img]},index)
        else:
            add_to_archive({'ID':[uid],'KIND':['user'],'VALUE':[fullName],'IMG':[img]})
        profile['invalid_fields'] = invalid_fields
        return profile
    except Exception as e:
        print('ERROR: writing data to user db')
        print(e)

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def save_profile_pic(uid,picture):
    ''' Save user profile picture onto the firebase storage bucket:
        profile/pics/. Rename profile picture with the user id (uid).
        It accept only jpeg, JPG, png, PNG files.

        first delete eventual old pictures, then get the new picture
        from the temp folder on the server, uplaod the picture to the
        firebase storage bucket, update profile reference on the database,
        update search_archive.
    '''
    try:
        try:
            bucket.blob('profile_pics/'+uid+'.jpeg').delete()
            bucket.blob('profile_pics/'+uid+'.JPG').delete()
            bucket.blob('profile_pics/'+uid+'.png').delete()
            bucket.blob('profile_pics/'+uid+'.PNG').delete()
        except:
            pass
        path_file = "temp/%s" % picture
        blob = bucket.blob('profile_pics/'+picture)
        blob.upload_from_filename(path_file)
        blob.make_public()
        os.remove(path_file)
        profile = db.collection(u'users').document(u'%s' % uid)
        server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
        df = pd.read_csv('search_archive/archive.csv')
        user_tuples = df.loc[df['ID'] == uid]
        user_tuples['IMG'].values[:] = server_path
        df.loc[df['ID'] == uid] = user_tuples
        df = df.drop_duplicates(subset=['ID'])
        df.to_csv('search_archive/archive.csv',index=False)
        dic = {'img':server_path}
        profile.set({'profile':dic}, merge=True)
        return server_path
    except:
        return {0:False}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def set_user_badge_reputation(uid):
    ''' Set the user badge and reputation.

        reputation is calculated as following:
            + 0.5 per bookmark
            + log2(|n. of votes|) if positive votes received > negative votes (both for comments and articles)
            - log2(|n. of votes|) if positive votes received < negative votes (both for comments and articles)
            + 1 per competition joined
            + 1 per article published
            + 1.2 per competition made
            reputation cannot be negative. and is always an integer number.

        the badge identify a user propension for one activity on the social platform.
        it also identify admins and moderators.
            - Novice : is the initial badge for every user with no activity
            - Reader : bookmarks > 0
            - Pro Reader : bookmarks > 5
            - Inquisitor : comments > 10
            - Contributor : competition joined > 0
            - Pro Contributor : competition joined > 4
            - Publisher : articles written > 0
            - Pro Publisher : articles written > 5
            - Competition Owner : competitions made > 0
            - Advanced Publisher : articles written > 10
            - Admin / Moderator
        The badges are mutually exclusive. One badge will substitute eventual other badges so that
        each user will have only one badge.
    '''
    badge = 'Novice'
    reputation = 0
    comp = 0
    try:
        profile_ref = db.collection(u'users').document(u'%s' % uid)
        profile = profile_ref.get()
        profile = profile.to_dict()
    except:
        return False, False
    if not profile:
        return False, False
    if 'saved_articles' in profile:
        badge = 'Reader'
        reputation += len(profile['saved_articles']) / 5
        if len(profile['saved_articles']) > 5:
            badge = 'Pro Reader'
    if 'comments' in profile:
        if 'votes' in profile['comments']:
            votes = int(profile['comments']['votes'])
            if votes > 0:
                reputation += math.log(abs(votes),2)
            else:
                reputation -= math.log(abs(votes),2)
        if len(profile['comments']) > 10:
            badge = 'Inquisitor'
    if 'competition_joined' in profile:
        badge = 'Contributor'
        reputation += len(profile['competition_joined'])
        if len(profile['competition_joined']) > 4:
            badge = 'Pro Contributor'
    if 'articles' in profile:
        badge = 'Publisher'
        reputation += len(profile['articles'])
        if len(profile['articles']) > 5:
            badge = 'Pro Publisher'
        for a in profile['articles']:
            try:
                art_ref = db.collection(u'articles').document(u'%s' % a)
                art = art_ref.get()
                art = art.to_dict()
                if 'pending' in art:
                    if art['pending'] != True:
                        if 'votes' in art:
                            votes = int(art['votes'])
                            if votes > 0:
                                reputation += math.log(abs(votes),2)
                            else:
                                reputation -= math.log(abs(votes),2)
                        if 'competition' in art:
                            if art['competition'] == True:
                                comp += 1
                                badge = 'Competition Owner'
            except:
                pass
        reputation += comp * 1.2
        if len(profile['articles']) > 10 and comp > 0 :
            badge = 'Advanced Publisher'
    if 'badge' in profile['profile']:
        if profile['profile']['badge'] == 'Admin' or profile['profile']['badge'] == 'Moderator' or profile['profile']['badge'] == 'Banned User':
            badge = profile['profile']['badge']
        else:
            profile['profile']['badge'] = badge
    if reputation < 0:
        reputation = 0
    else:
        reputation = round(reputation)
    profile['profile']['reputation'] = reputation

    profile_ref.set({'profile':{'badge':badge,'reputation':str(reputation)}},merge=True)
    return profile_ref, profile

# ----- WRITE - ARTICLES DATA TO FIREBASE -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def save_article_img(articleID,picture,orientation):
    ''' Save an article main image from the temp folder, then update the
        database references.
    '''
    path_file = "temp/%s" % picture
    blob = bucket.blob('articles/%s/%s' % (articleID,picture))
    blob.upload_from_filename(path_file)
    blob.make_public()
    os.remove(path_file)
    article = db.collection(u'articles').document(u'%s' % articleID)
    server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
    dic = {'img':{'url':server_path,'orientation':orientation}}
    article.set(dic, merge=True)
    return {'exit':0}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def save_competition_resources(articleID):
    ''' Save competition resources
    '''
    path_file = "comp_folder/%s/comp_resources.zip" % (articleID)
    blob = bucket.blob('articles/%s/comp_resources.zip' % (articleID))
    blob.upload_from_filename(path_file)
    blob.make_public()
    os.remove(path_file)
    article = db.collection(u'articles').document(u'%s' % articleID)
    server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
    dic = {'comp_resources':server_path}
    article.set(dic, merge=True)
    return {'exit':0}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def edit_article(edits):
    ''' Save a new article with the edits with a temporary article ID on the
        database and the firebase storage then links the edited article with the
        edit on the database. (see save_article function).
    '''
    save_article(edits['temp_aid'],edits['uid'],edits['temp_path'])
    art_ref = db.collection(u'articles').document(u'%s' % edits['temp_aid'])
    art_ref.set({'edit_of' : edits['aid']},merge=True)
    if 'picture' in edits and 'orientation' in edits:
        save_article_img(edits['temp_aid'],edits['picture'],edits['orientation'])
    if 'resources' in edits:
        for res in edits['resources']:
            save_article_resources(edits['temp_aid'],res)
    return {0:True}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def save_article(articleID,authorID,temp_path):
    ''' Save article from temp folder on the firebase storage, update/create database reference
        to the article.
    '''
    timestamp = datetime.datetime.now().timestamp()
    article = articleID + '.md'
    path_file = "temp/%s" % article
    blob = bucket.blob('articles/%s/%s' % (articleID,article))
    blob.upload_from_filename(path_file)
    blob.make_public()
    server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
    article = db.collection(u'articles').document(u'%s' % articleID)
    exists = article.get().exists
    if exists == True and 'author' in article.get().to_dict():
        dic = {'content':server_path, 'edit':{'editor':authorID,'time':str(int(datetime.datetime.now().timestamp()))}, 'pending':True}
        article.set(dic,merge=True)
    else:
        dic = {'content':server_path, 'author':authorID, 'pending':True,'timestamp':str(int(timestamp))}
        article.set(dic, merge=True)
        profile = db.collection(u'users').document(u'%s' % authorID)
        profile.update({'articles':firestore.ArrayUnion([articleID])})
    os.remove(path_file)
    return {0:True}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def save_article_resources(articleID,filename):
    ''' Save eventual attachments to the article into the firebase storage and links
        them to the database to render them available for download on the client site.
    '''
    path_file = "temp/%s" % filename
    blob = bucket.blob('articles/%s/resources/%s' %(articleID,filename))
    blob.upload_from_filename(path_file)
    blob.make_public()
    os.remove(path_file)
    server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
    article = db.collection(u'articles').document(u'%s' % articleID)
    article.update({'resources':firestore.ArrayUnion([server_path])})
    return {'exit':0}

# ----- WRITE - COMPETITION DATA TO FIREBASE -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def add_comp(articleID,weighted_evas,competition_type):
    ''' add a competition to the article identified with articleID by creating
        the required fields in the database.
    '''
    art_ref = db.collection(u'articles').document(u'%s' % articleID)
    art_ref.set({'competition':True,'weighted_evas':weighted_evas,'competition_type':competition_type},merge=True)
    return {'exit':0}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_article(articleID):
    ''' Get a specific article indentified by articleID

        The article reference from the database is formatted for the client site in
        a JSON dictionary format and the article content or file is converted into
        html and saved as a string into the dictionary so that it can be rendered
        easily from the frontend.
    '''
    if articleID == 'false':
        return {0:False}
    art_dict = {
        'articleID' : articleID,
        'title' : '',
        'text' : '',
        'img' : '',
        'orientation' : '',
        'author' : '',
        'authorImg' : '',
        'pending' : False,
        'competition' : False,
        'date' : '',
        'time' : '',
        'timestamp' : '',
        'authorID' : '',
        'md_text': ''
    }
    art_ref = db.collection(u'articles').document(u'%s' % articleID)
    article = art_ref.get()
    article = article.to_dict()
    if 'resources_ref' in article:
        art_dict['resources_ref'] = article['resources_ref']
    if 'edit_of' in article:
        art_dict['edit_of'] = article['edit_of']
        original_art = db.collection(u'articles').document(u'%s' % article['edit_of'])
        original_art = original_art.get()
        original_art = original_art.to_dict()
        article['editorID'] = article['author']
        article['original_timestamp'] = original_art['timestamp']
        article['author'] = original_art['author']
        art_dict['editorID'] = article['editorID']
        art_dict['original_timestamp'] = article['original_timestamp']
        editor_prof = db.collection(u'users').document(u'%s' % art_dict['editorID'])
        editor_prof = editor_prof.get()
        editor_prof = editor_prof.to_dict()
        if 'img' in editor_prof['profile']:
            art_dict['editor_img'] = editor_prof['profile']['img']
        else:
            art_dict['editor_img'] = ''

        if 'competition' in original_art:
            art_dict['competition'] = original_art['competition']
            if 'competition_closed' in original_art:
                art_dict['competition_closed'] = original_art['competition_closed']
    first_line = True
    authorID = article['author']
    art_dict['authorID'] = authorID
    if 'editorID' in art_dict:
        art_dict['editor'] = get_fullName(art_dict['editorID'])
    art_dict['author'] = get_fullName(authorID);
    art_dict['authorImg'] = get_profilePic(authorID);
    if 'timestamp' in article:
        art_dict['timestamp'] = article['timestamp']
        date = datetime.datetime.fromtimestamp(int(article['timestamp']))
        art_dict['date'] = date.strftime('%d/%m/%y')
        art_dict['time'] = date.strftime('%H:%M:%S')
    if 'original_timestamp' in art_dict:
        date = datetime.datetime.fromtimestamp(int(article['original_timestamp']))
        art_dict['original_date'] = date.strftime('%d/%m/%y')
        art_dict['original_time'] = date.strftime('%H:%M:%S')
    if 'img' in article:
        art_dict['img'] = article['img']['url']
        art_dict['orientation'] = article['img']['orientation']
    if 'pending' in article:
        art_dict['pending'] = article['pending']
    if 'competition' in article:
        art_dict['competition'] = article['competition']
        if 'competition_closed' in article:
            art_dict['competition_closed'] = article['competition_closed']
    # print(article['content'])
    for line in urllib.request.urlopen(article['content']):
        line = line.decode('utf8')
        art_dict['md_text'] += line
        if "#" in line and first_line == True:
            art_dict['title'] = line.replace('#','')
            first_line = False
        else:
            art_dict['text'] += line
    if art_dict['title'] == '':
        return {0:False}
    art_dict['text'] = pypandoc.convert_text(art_dict['text'],'html',format='md')
    art_dict['text'] = art_dict['text'].replace('"',"'")
    art_dict['text'] = art_dict['text'].replace('\n',"")
    art_dict['text'] = improve_md_format(art_dict['text'])
    return art_dict

# ----- GET - ARTICLE DATA FROM FIREBASE -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_full_article(articleID):
    ''' While get_article separate the article title from the rest of the article
        text for formatting purposes (e.g see dashboard cards); this function
        returns the same JSON dictionary format but the whole article text is in a single
        key: full_text.
    '''
    art = get_article(articleID)
    title = '# ' + art['title'] + ' \n'
    art['full_text'] = title + art['text']
    art['full_text'] = pypandoc.convert_text(art['full_text'],'html',format='md')
    art['full_text'] = art['full_text'].replace('"',"'")
    art['full_text'] = art['full_text'].replace('\n','')
    art['full_text'] = improve_md_format(art['full_text'])
    return art

def improve_md_format(text):
    ''' This is an accessory function to assist pandoc in the markdown to html
        conversion by providing underline and highlight text format and also
        redirecting all eventual links present in the article to be opened in a new window.
    '''
    text = underline_md_format(text)
    text = highlight_md_format(text)
    text = target_links_toBlank(text)
    return text

def underline_md_format(text):
    ''' see improve_md_format '''
    formatted_text = ''
    while text.find('++') != -1:
        start = text.find('++') + 2
        end = start + text[start:].find('++')
        mod = '<u>' + text[start:end] + '</u>'
        formatted_text += text[:start-2] + mod
        text = text[end+2:]
    formatted_text += text
    return formatted_text

def highlight_md_format(text):
    ''' see improve_md_format '''
    formatted_text = ''
    while text.find('==') != -1:
        start = text.find('==') + 2
        end = start + text[start:].find('==')
        mod = '<mark>' + text[start:end] + '</mark>'
        formatted_text += text[:start-2] + mod
        text = text[end+2:]
    formatted_text += text
    return formatted_text

def target_links_toBlank(text):
    ''' see improve_md_format '''
    formatted_text = ''
    temp_text = text
    while temp_text.find('<a href="') != -1:
        start = temp_text.find('<a href="') + 9
        end = start + temp_text[start:].find('"')+1
        mod = temp_text[:end] + ' target="_blank" '
        formatted_text += mod
        temp_text = temp_text[end:]
    formatted_text += temp_text
    return formatted_text

@retry(wait_exponential_multiplier=1000, wait_exponential_max=5000, stop_max_delay=30000)
def get_all_articles(pending):
    ''' get all articles. if pending == True, get also articles pending approval.
        If an article has been edited and the edit has been approved, get the edited article
        instead.
    '''
    articles_list = []
    order_dict = {}
    unordered_dict = {}
    art_ref = db.collection(u'articles').stream()
    for a in art_ref:
        article = a.to_dict()
        a_ref =  db.collection(u'articles').document(u'%s' % a.id)
        if (pending == False and 'pending' in article and article['pending'] == True):
            pass
        else:
            article = a.to_dict()
            unordered_dict[a.id] = article
            if 'edit' in article:
                order_dict[int(article['edit']['time'])] = a.id
            else:
                order_dict[int(article['timestamp'])] = a.id
    ordered = collections.OrderedDict(sorted(order_dict.items(),reverse=True))
    for time in list(ordered.keys()):
        art = unordered_dict[ordered[time]]
        art['authorID'] = art['author']
        art['author'] = get_fullName(art['authorID'])
        art['authorImg'] = get_profilePic(art['authorID'])
        date = datetime.datetime.fromtimestamp(int(art['timestamp']))
        art['date'] = date.strftime('%d/%m/%y')
        art['time'] = date.strftime('%H:%M:%S')
        if 'edit' in art:
            date = datetime.datetime.fromtimestamp(int(art['edit']['time']))
            art['edit']['date'] = date.strftime('%d/%m/%y')
            art['edit']['time'] = date.strftime('%H:%M:%S')
        first_line = True
        text = ''
        for line in urllib.request.urlopen(art['content']):
            line = line.decode('utf8')
            if "#" in line and first_line == True:
                art['title'] = line.replace('#','')
                first_line = False
            else:
                text += line
        text = pypandoc.convert_text(text,'html',format='md')
        text = text.replace('"',"'")
        text = text.replace('\n','')
        text = improve_md_format(text)
        art['text'] = text
        art['articleID'] = ordered[time]
        add_articles_archive(art['articleID'],art)
        articles_list.append(art)
    return articles_list

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_additional_resources(aid):
    ''' return additional resources (attachments) for a specific article if any '''
    resources_dict = {}
    blobs = list(bucket.list_blobs())
    for blob in blobs:
        if 'articles/'+aid+'/resources/' in blob.name:
            server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
            filename = blob.name[::-1]
            filename = filename[:filename.find('/')]
            filename = filename[::-1]
            resources_dict[filename] = server_path
    return resources_dict

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_author_profile(aid):
    ''' Get the author profile info for a specific article identified via article id (aid).
        It is used by the client to display author info below each article.
    '''
    art_ref = db.collection(u'articles').document(u'%s'%aid)
    art = art_ref.get()
    art = art.to_dict()
    authorID = art['author']
    prof_ref = db.collection(u'users').document(u'%s'%authorID)
    prof = prof_ref.get()
    prof = prof.to_dict()
    prof = prof['profile']
    profile = {
        'authorID' : authorID,
        'full_name' : prof['name'] + ' ' + prof['surname'],
        'img' : prof['img'],
        'qualifications' : '',
        'email' : '',
        'phone' : ''
    }
    if 'qualifications' in prof:
        profile['qualifications'] = prof['qualifications']
    if 'public_email' in prof:
        profile['email'] = prof['public_email']
    if 'phone' in prof:
        profile['phone'] = prof['phone']
    return profile

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_article_full(aid):
    ''' A newer, improved version of get_full_article.
        It gives additional info regarding the article such as submissions,
        competition files, author and editor profiles etc.

        It is a more expensive request compared to the other get article functions.
        That's why those coexists here.
    '''
    article = {}
    art_ref = db.collection(u'articles').document(u'%s' % aid)
    art = art_ref.get()
    art = art.to_dict()
    article['main'] = art
    article['main']['articleID'] = aid
    sub_profiles = {}
    com_profiles = {}
    if 'edit' in art:
        article['main']['edit']['editorID'] = article['main']['edit']['editor']
        article['main']['edit']['editor'] = get_fullName(article['main']['edit']['editorID'])
        article['main']['edit']['editorImg'] = get_profilePic(article['main']['edit']['editorID'])
        date = datetime.datetime.fromtimestamp(int(article['main']['edit']['time']))
        article['main']['edit']['date'] = date.strftime('%d/%m/%y')
        article['main']['edit']['time'] = date.strftime('%H:%M:%S')
    if 'competition' in art:
        article['comp_files'] = get_comp_files(article['main']['articleID'])
        submissions = get_all_submissions(aid)
        if len(submissions) > 0:
            article['submissions'] = submissions
            for s in submissions:
                sub = s[list(s.keys())[0]]
                aut_sub = sub['author']
                prof = get_user(aut_sub)
                sub_profiles[prof['userID']] = prof
            article['sub_profiles'] = sub_profiles
    article['main']['authorID'] = article['main']['author']
    article['main']['author'] = get_fullName(article['main']['authorID'])
    article['main']['authorImg'] = get_profilePic(article['main']['authorID'])
    date = datetime.datetime.fromtimestamp(int(article['main']['timestamp']))
    article['main']['date'] = date.strftime('%d/%m/%y')
    article['main']['time'] = date.strftime('%H:%M:%S')
    comments = get_comments(aid)
    if len(comments) > 0:
        article['comments'] = comments
        for i,c in enumerate(comments):
            com = c[list(c.keys())[0]]
            aut_com = com['author']
            prof = get_user(aut_com)
            if 'editor' in com:
                article['comments'][i][list(c.keys())[0]]['editor_fullName'] = get_fullName(com['editor'])
            com_profiles[prof['userID']] = prof
        article['com_profiles'] = com_profiles
    text = ''
    for line in urllib.request.urlopen(article['main']['content']):
        line = line.decode('utf8')
        text += line
    text = pypandoc.convert_text(text,'html',format='md')
    text = improve_md_format(text)
    article['main']['full_text'] = text
    return article

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_comments(aid):
    comments_list = []
    comments = db.collection(u'articles').document(u"%s" % aid).collection(u'comments').stream()
    for c in comments:
        user, com = c.id, c.to_dict()
        for k in list(com.keys()):
            com[k]['author'] = user
        comments_list.append(com)
    return comments_list

# ----- GET - USER DATA FROM DATABASE -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_profilePic(uid):
    profile_ref = db.collection(u'users').document(u'%s' % uid)
    profile = profile_ref.get()
    profile = profile.to_dict()
    if 'img' in profile['profile']:
        return profile['profile']['img']
    return ''

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_all_users():
    ''' get all users profiles. It is used in the admin page to display all registered users. '''
    users = db.collection(u'users').stream()
    users_list = []
    for u in users:
        id,user = u.id, u.to_dict()
        user['userID'] = id
        users_list.append(user)
    return users_list

@retry(wait_exponential_multiplier=1000, wait_exponential_max=5000, stop_max_delay=30000)
def get_user(uid,*email):
    ''' get user profile when logging in.
        If the user is not found, the optional email field will be used to create a new user.
        It is triggered at every user visit and update the last visit time.
        It is particularly useful in the admin page so that new articles from the last user
        visit will be highlighted.
    '''
    user_ref, user = set_user_badge_reputation(uid)
    if user_ref == False and user == False:
        create_new_user(uid,email[0])
        user_ref, user = set_user_badge_reputation(uid)
    visit = datetime.datetime.now().strftime('%d%m%y')
    if 'last_visits' in user and len(user['last_visits'])>1:
        if user['last_visits'][1] != visit:
            user['last_visits'][0] = user['last_visits'][1]
            user['last_visits'][1] = visit
            user_ref.set({'last_visits': user['last_visits']},merge=True)
            user = user_ref.get()
            user = user.to_dict()
    else:
        user_ref.update({'last_visits': firestore.ArrayUnion([visit])})
        user = user_ref.get()
        user = user.to_dict()

    art_IDS = []
    art_collection = db.collection(u'articles').stream()
    for art in art_collection:
        art_IDS.append(art.id)

    if 'articles' in user:
        temp_list = []
        for i,el in enumerate(user['articles']):
            if el in art_IDS:
                temp_list.append(el)
        user['articles'] = temp_list
        user_ref.set({'articles':user['articles']},merge=True)
    if 'comments' in user:
        temp_list = []
        for i,el in enumerate(user['comments']):
            if el in art_IDS:
                temp_list.append(el)
        user['comments'] = temp_list
        user_ref.set({'comments':user['comments']},merge=True)
    if 'competition_joined' in user:
        temp_list = []
        for i,el in enumerate(user['competition_joined']):
            if el in art_IDS:
                temp_list.append(el)
        user['competition_joined'] = temp_list
        user_ref.set({'competition_joined':user['competition_joined']},merge=True)
    if 'saved_articles' in user:
        temp_list = []
        for i,el in enumerate(user['saved_articles']):
            if el in art_IDS:
                temp_list.append(el)
        user['saved_articles'] = temp_list
        user_ref.set({'saved_articles':user['saved_articles']},merge=True)

    user['userID'] = user_ref.id
    return user

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_fullName(uid):
    profile_ref = db.collection(u'users').document(u'%s' % uid)
    profile = profile_ref.get()
    profile = profile.to_dict()
    profile = profile['profile']
    return profile['name'] + " " + profile['surname']

# ----- GET - COMPETITION DATA FROM FIREBASE -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def request_comp_file(articleID):
    ''' Get competition files for download on competition.
        Competition files are the training and validation set
        and the optional: data description and other resources.

        this function differs from get_comp_files because it checks for
        edits in the article before collecting the competition files
        while in get_comp_files this check is made by the parent function:
        get_article_full.
    '''
    art_ref = db.collection(u'articles').document(u'%s'%articleID)
    art = art_ref.get()
    art = art.to_dict()
    if 'edit_of' in art:
        return request_comp_file(art['edit_of'])

    zipPath = art['comp_resources']
    r = requests.get(zipPath, stream = True)
    if os.path.exists('comp_folder/%s' % articleID):
        os.remove('comp_folder/%s' % articleID)
    with open("comp_folder/%s.zip" % articleID, "wb") as zipFile:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:
                zipFile.write(chunk)
    shutil.unpack_archive('comp_folder/%s.zip' % articleID,'comp_folder','zip')

    files = []
    dirlist = os.listdir("comp_folder/%s" % articleID)
    if 'private' in dirlist:
        dirlist.remove('private')
    for f in dirlist:
        name = f[:f.find('.')]
        format = f[f.find('.'):]
        size = os.path.getsize("comp_folder/%s/%s" % (articleID,f))
        try:
            df = pd.read_csv("comp_folder/%s/%s" % (articleID,f))
            dimensions = str(df.shape[0]) + " Rows<br>" + str(df.shape[1]) + " Columns"
        except:
            dimensions = '-'

        file_dic = {
            'name':f,
            'format':format,
            'size':size,
            'dimensions':dimensions
        }
        files.append(file_dic)
    return files

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_comp_files(articleID):
    ''' Get the competition files.
        This function differs from request_comp_file because it does not check for
        edits in the article before collecting the competition files.
        This check is made by the parent function:
        get_article_full.
    '''
    files = []
    try:
        dirlist = os.listdir("comp_folder/%s" % articleID)
        if 'private' in dirlist:
            dirlist.remove('private')
        for f in dirlist:
            name = f[:f.find('.')]
            format = f[f.find('.'):]
            size = os.path.getsize("comp_folder/%s/%s" % (articleID,f))
            try:
                df = pd.read_csv("comp_folder/%s/%s" % (articleID,f))
                dimensions = str(df.shape[0]) + " Rows<br>" + str(df.shape[1]) + " Columns"
            except:
                dimensions = '-'

            file_dic = {
                'name':f,
                'format':format,
                'size':size,
                'dimensions':dimensions
            }
            files.append(file_dic)
    except:
        pass
    return files

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_all_submissions(aid):
    submissions_list = []
    submissions = db.collection(u'articles').document(u"%s" % aid).collection(u'submissions').stream()
    for s in submissions:
        user, sub = s.id, s.to_dict()
        for k in list(sub.keys()):
            sub[k]['author'] = user
        submissions_list.append(sub)
    return submissions_list

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def get_submissions(uid,competition_joined):
    all_submissions = []
    for comp in competition_joined:
        sub_ref = db.collection(u'articles').document(u'%s' %comp).collection(u'submissions').document(u'%s' %uid)
        sub = sub_ref.get()
        if sub.exists == True:
            submissions = sub.to_dict()
            submissions['article'] = get_article(comp)
            all_submissions.append(submissions)
    return all_submissions

# ----- USER - COMPETITION INTERACTIONS -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def is_user_joined(uid,aid):
    ''' Check if user has already joined the competition '''
    prof_ref = db.collection(u'users').document(u'%s' % uid)
    prof = prof_ref.get()
    prof = prof.to_dict()
    if 'competition_joined' in prof and aid in prof['competition_joined']:
        return True
    else:
        art_ref = db.collection(u'articles').document(u'%s'%aid)
        art = art_ref.get()
        art = art.to_dict()
        if 'edit_of' in art:
            return is_user_joined(uid,art['edit_of'])
        return False

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def join_competition(uid,aid):
    try:
        profile = db.collection(u'users').document(u'%s' % uid)
        profile.update({'competition_joined':firestore.ArrayUnion([aid])})
        return True
    except:
        return False

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def submit_comp_results(uid,aid,filename,link):
    ''' Save competition results on the database and storage.
        also call calculate_sub_scores to evaluate the results.
    '''
    submissionID = str(int(datetime.datetime.now().timestamp()))
    user_subs_ref = db.collection(u'articles').document(u'%s' % aid).collection(u'submissions').document(u'%s' % uid)
    user_subs = user_subs_ref.get()
    if user_subs.exists:
        subs_dict = user_subs.to_dict()
        timestamps = set(subs_dict.keys())
        dates = [time.gmtime(int(x)) for x in timestamps]
        today = time.gmtime()
        today_subs = [x for x in dates if x.tm_year == today.tm_year and x.tm_yday == today.tm_yday]
        if len(today_subs) >= 5:
            return {'Error':"Sorry, you have reach the limit of 5 submissions per day. Please try again tomorrow."}

    path_file = "temp/%s" % filename
    blob = bucket.blob('articles/%s/comp_submissions/%s/%s/%s' %(aid,uid,submissionID,filename))
    blob.upload_from_filename(path_file)
    blob.make_public()
    os.remove(path_file)
    server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
    art_ref = db.collection(u'articles').document(u'%s' % aid)
    art = art_ref.get()
    art = art.to_dict()
    competition_type = art['competition_type']
    weighted_evas = art['weighted_evas']
    scores = calculate_sub_scores(server_path,aid,competition_type)
    if scores == False or "Error" in scores:
        blob.delete()
        return scores
    for score in list(scores.keys()):
        if str(scores[score]) == 'nan':
            scores[score] = 0
    weighted_score = 0
    for eva in weighted_evas.keys():
        if eva == 'MAE' or eva == 'MSE' or eva == 'RMSE':
            score_weight = float(scores[eva]) * (float(weighted_evas[eva])*-1)
        else:
            try:
                score_weight = float(scores[eva]) * float(weighted_evas[eva])
            except KeyError:
                if eva != 'AUC':
                    raise KeyError
        weighted_score += score_weight
    weighted_score = round(weighted_score * 1000)
    sub_ref = db.collection(u'articles').document(u'%s' % aid).collection(u'submissions').document(u'%s' % uid)
    sub_ref.set({submissionID:{'results':server_path,'code_link':link,'scores':scores,'weighted_score':weighted_score}},merge=True)
    recalculate_leaderscore()
    return True

# this is only an admin tool, do not use in production (comment)
def recalculate_leaderscore3(df):
    for art in df['article'].unique():
        art_df = df.loc[df['article'] == art].copy()
        art_df.sort_values(by=['max_score'], inplace=True, ascending=False)
        art_df.to_csv('backups/art_df.csv',index=False)
        users_positions = {}
        for i,u in enumerate(art_df['user'].unique()):
            users_positions[u] = i+1
        for _, row in art_df.iterrows():
            sub_ref = db.collection(u'articles').document(art).collection('submissions').document(row['user'])
            user_subs = sub_ref.get().to_dict()
            for s in user_subs.keys():
                user_subs[s]['leader_score'] = {'position': str(users_positions[row['user']]), 'total_participants': str(art_df.shape[0])}
            sub_ref.set(user_subs, merge=True)

def recalculate_leaderscore2():
    articles_ref = db.collection(u'articles').stream()
    leaderboard_df = pd.DataFrame()
    for art_ref in articles_ref:
        art = art_ref.to_dict()
        sub_ref = db.collection(u'articles').document(art_ref.id).collection('submissions').stream()
        for user in sub_ref:
            if user.exists:
                user_sub = user.to_dict()
                user_submissions_scores_dict = {}
                for subID in user_sub.keys():
                    user_submissions_scores_dict[subID] = user_sub[subID]['weighted_score']
                best_subID = max(user_submissions_scores_dict, key=user_submissions_scores_dict.get)
                user_df = pd.DataFrame({'article':[art_ref.id], 'user':[user.id],'max_score': [user_submissions_scores_dict[best_subID]], 'best_subID':[ best_subID]})
                if not leaderboard_df.empty:
                    leaderboard_df = pd.concat([leaderboard_df,user_df], axis=0, ignore_index=True)                    
                else:
                    leaderboard_df = user_df
    if not leaderboard_df.empty:
        recalculate_leaderscore3(leaderboard_df)

def recalculate_leaderscore():
    articles_ref = db.collection(u'articles').stream()
    leaderboard_df = pd.DataFrame()
    for art_ref in articles_ref:
        art = art_ref.to_dict()
        if 'weighted_evas' in art:
            weighted_evas = art['weighted_evas']
            sub_ref = db.collection(u'articles').document(art_ref.id).collection(u'submissions').stream()
            for user in sub_ref:
                if user.exists:
                    user_sub = user.to_dict()
                    for subID in user_sub.keys():
                        submission = user_sub[subID]
                        scores = submission['scores']
                        weighted_score = 0
                        for eva in scores.keys():
                            if eva == 'MAE' or eva == 'MSE' or eva == 'RMSE':
                                score_weight = float(scores[eva]) * (float(weighted_evas[eva])*-1)
                            else:
                                # try:
                                score_weight = float(scores[eva]) * float(weighted_evas[eva])
                                # except KeyError:
                                #     if eva != 'AUC':
                                #         raise KeyError
                            weighted_score += score_weight
                        weighted_score = round(weighted_score * 1000)
                        user_sub[subID]['weighted_score'] = weighted_score
                    user_ref = db.collection(u'articles').document(art_ref.id).collection(u'submissions').document(user.id)
                    user_ref.set(user_sub, merge=True)
    recalculate_leaderscore2
    return dict()
            



@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def calculate_sub_scores(sub_path,aid,competition_type):
    ''' Calculate submission score:

        check if the uploaded results format matches the accepted one:
            - the target feature is named as "class".
            - if classification: the number of classes in the results must be
                less than or equal to the number of classes in the competition.
        also check if the evaluation measures are in the acceptable ranges.
    '''
    df_sub = pd.read_csv(sub_path)
    df_private = pd.read_csv('comp_folder/%s/private/validation_set_private.csv' % aid)
    df_sub = df_sub.rename(columns={'class':'prediction'})
    df = pd.concat([df_sub['prediction'],df_private['class']],axis=1)
    try:
        y_true = list(df['class'])
        y_pred = list(df['prediction'])
        score_dict = {}
        if competition_type == 'classification':
            class_type = str(df['class'].dtype).lower()
            pred_type = str(df['prediction'].dtype).lower()
            if "int" in class_type or "float" in class_type:
                try:
                    class_int = df['class'].round()
                    pred_int = df['prediction'].round()
                    class_int = class_int.astype('int64')
                    pred_int = pred_int.astype('int64')
                    class_num = len(class_int.unique())
                    pred_num = len(pred_int.unique())
                    if class_num > pred_num:
                        return {"Error": "The submission contains more classes than the Validation Dataset."}
                except:
                    return {"Error": "The submission datatype is not compatible with the validation dataset."}            
            if class_type != pred_type and "str" not in class_type:
                y_true = [round(num) for num in y_true]
                y_pred = [round(num) for num in y_pred]
            if class_num == 2:
                fpr, tpr, _ = roc_curve(y_true, y_pred)
                score_dict = {
                    'Accuracy': (round(accuracy_score(y_true,y_pred)*100)/100),
                    'F1-Measure' : (round(f1_score(y_true,y_pred)*100)/100),
                    'Precision' : (round(precision_score(y_true,y_pred)*100)/100),
                    'Recall' : (round(recall_score(y_true,y_pred)*100)/100),
                    'AUC' : (round(auc(fpr,tpr)*100)/100),
                    'MCC' : (round(matthews_corrcoef(y_true,y_pred)*100)/100)
                }
            else:
                # Comment this line to use un-weighted MCC
                wm = Weighted_metrics(y_true,y_pred)
                score_dict = {
                    'Accuracy': (round(accuracy_score(y_true,y_pred)*100)/100),
                    'F1-Measure' : (round(f1_score(y_true,y_pred, average='macro')*100)/100),
                    'Precision' : (round(precision_score(y_true,y_pred, average='macro')*100)/100),
                    'Recall' : (round(recall_score(y_true,y_pred, average='macro')*100)/100),
                    # Modify this line to use un-weighted MCC
                    'MCC' : (round(wm.weighted_matthews_corcoef()*100)/100)
                }
            for key in list(score_dict.keys()):
                value = score_dict[key]
                if key == 'MCC':
                    if value > 1 or value < -1:
                        return {"Error":"%s out of range." % value}
                else:
                    if value > 1 or value < 0:
                        return {"Error":"%s out of range." % value}
        elif competition_type == 'regression':
            score_dict = {
                'MAE': (round(mean_absolute_error(y_true,y_pred)*100)/100),
                'MSE': (round(mean_squared_error(y_true,y_pred)*100)/100),
                'RMSE': (round(sqrt(mean_squared_error(y_true, y_pred))*100)/100),
                'R2': (round(r2_score(y_true,y_pred)*100)/100)
            }
            if score_dict['R2'] > 1 or score_dict['R2'] < 0:
                return {"Error":"R2 out of range."}
        return score_dict
    except:
        return False

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def close_competition(aid):
    ''' The competition owner, admin and moderators can close a competition at any time.
        The closed competition will still be seen but will be marked as closed and no more
        submission will be allowed.
    '''
    art_ref = db.collection(u'articles').document(u'%s'%aid)
    art = art_ref.get()
    art = art.to_dict()
    if 'competition_closed' in art and art['competition_closed'] == True:
        return {'response':'already_closed'}
    else:
        art_ref.set({'competition_closed':True},merge=True)
        return {'response':'success'}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def update_leaderscore(uid,aid,position,total_participants,subID):
    ''' Update the leaderscore of each submission based on the weighted evaluation measures. '''
    sub_ref = db.collection(u'articles').document(u'%s' %aid).collection(u'submissions').document(u'%s' %uid)
    subs = sub_ref.get().to_dict()
    for sub in list(subs.keys()):
        if sub == subID:
            subs[sub]['leader_score'] = {'position':position,'total_participants':total_participants}
        elif 'leader_score' in subs[sub]:
            del subs[sub]['leader_score']
    sub_ref.set(subs,merge=True)
    return {0:True}

# ----- USER - ARTICLE INTERACTIONS -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def save_article_bookmark(uid,aid,is_saved):
    ''' Save article bookmark reference in the user record on the database '''
    prof_ref = db.collection(u'users').document(u'%s' % uid)
    if is_saved == 'false':
        prof_ref.update({'saved_articles':firestore.ArrayUnion([aid])})
        return {0:True}
    elif is_saved == 'true':
        prof = prof_ref.get()
        prof = prof.to_dict()
        saved_articles = prof['saved_articles']
        saved_articles.remove(aid)
        prof_ref.set({'saved_articles':saved_articles},merge=True)
        return {0:False}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def check_if_saved(uid,aid):
    ''' Check if an article has been already saved as bookmark by the user '''
    prof_ref = db.collection(u'users').document(u'%s' % uid)
    prof = prof_ref.get()
    prof = prof.to_dict()
    if 'saved_articles' in prof:
        if aid in prof['saved_articles']:
            return {0:True}
    return {0:False}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def create_new_comment(uid,aid,comment,time,commentID):
    prof_ref = db.collection(u'users').document(u'%s' % uid)
    com_ref = db.collection(u'articles').document(u'%s' % aid).collection('comments').document(u'%s' % uid)
    prof_ref.update({'comments':firestore.ArrayUnion([commentID])})
    comment_dict = {
        'text' : comment,
        'date_created' : time.strftime('%d/%m/%y'),
        'time_created' : time.strftime('%H:%M:%S'),
        'time' : str(int(datetime.datetime.now().timestamp())),
        'votes' : 0
    }
    com_ref.set({commentID:comment_dict},merge=True)
    profile = prof_ref.get()
    profile = profile.to_dict()
    profile = profile['profile']
    comment_dict['author_fullName'] = profile['name'] + ' ' + profile['surname']
    comment_dict['author_pic'] = profile['img']
    comment_dict['id'] = commentID
    comment_dict['authorID'] = uid
    return comment_dict

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def vote(aid,uid,id,up_down):
    ''' Add or remove a vote from an element (comment or article) for a specific user.

        It checks weather the user as already voted the element or not. the user can
        then upvote or downvote an element only once. by upvoting an already downvoted
        element, the user remove its previous vote and vice versa.
    '''
    if aid != id:
        all_users_comments = db.collection(u'articles').document(u'%s'%aid).collection('comments').stream()
        comment_author = ''
        for c in all_users_comments:
            authorID, comment = c.id, c.to_dict()
            if id in list(comment.keys()):
                comment_author = authorID
                break
        if authorID != '':
            com_ref = db.collection(u'articles').document(u'%s' % aid).collection('comments').document(u'%s' % authorID)
            com = com_ref.get()
            com = com.to_dict()
            com = com[id]
            votes = com['votes']
            set_vote = True
            if up_down == 'up':
                if 'upvotes' in com:
                    for u in com['upvotes']:
                        if u == uid:
                            return {0:False}
                if 'downvotes' in com:
                    for u in com['downvotes']:
                        if u == uid:
                            temp_array = com['downvotes']
                            temp_array.remove(uid)
                            com_ref.set({id:{'downvotes':temp_array}},merge=True)
                            set_vote = False
                            break
                if set_vote == True:
                    com_ref.update({id:{'upvotes': firestore.ArrayUnion([uid])}})
                votes += 1
            elif up_down == 'down':
                if 'downvotes' in com:
                    for u in com['downvotes']:
                        if u == uid:
                            return {0:False}
                if 'upvotes' in com:
                    for u in com['upvotes']:
                        if u == uid:
                            temp_array = com['upvotes']
                            temp_array.remove(uid)
                            com_ref.set({id:{'upvotes':temp_array}},merge=True)
                            set_vote = False
                            break
                if set_vote == True:
                    com_ref.update({id:{'downvotes':firestore.ArrayUnion([uid])}})
                votes -= 1
            com_ref.set({id:{'votes':votes}},merge=True)
            return {0:True}
        else:
            return {0:False}
    else:
        art_ref = db.collection(u'articles').document(u'%s' % aid)
        art = art_ref.get()
        art = art.to_dict()
        if 'votes' not in art:
            art_ref.set({'votes':{'vote':0,'upvotes':[],'downvotes':[]}},merge=True)
            art = art_ref.get()
            art = art.to_dict()
        vote = art['votes']['vote']
        set_vote = True
        if up_down == 'up':
            if 'upvotes' in art['votes']:
                for u in art['votes']['upvotes']:
                    if u == uid:
                        return {0:False}
            if 'downvotes' in art['votes']:
                for u in art['votes']['downvotes']:
                    if u == uid:
                        temp_array = art['votes']['downvotes']
                        temp_array.remove(uid)
                        art_ref.set({'votes':{'downvotes':temp_array}},merge=True)
                        set_vote = False
                        break
            if set_vote == True:
                art_ref.update({'votes':{'upvotes':firestore.ArrayUnion([uid])}})
            vote += 1
            art_ref.set({'votes':{'vote':vote}},merge=True)
        elif up_down == 'down':
            if 'downvotes' in art['votes']:
                for u in art['votes']['downvotes']:
                    if u == uid:
                        return {0:False}
            if 'upvotes' in art['votes']:
                for u in art['votes']['upvotes']:
                    if u == uid:
                        temp_array = art['votes']['upvotes']
                        temp_array.remove(uid)
                        art_ref.set({'votes':{'upvotes':temp_array}},merge=True)
                        set_vote = False
                        break
            if set_vote == True:
                art_ref.update({'votes':{'downvotes':firestore.ArrayUnion([uid])}})
            vote -= 1
            art_ref.set({'votes':{'vote':vote}},merge=True)
        return {0:True}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def download_article(aid):
    ''' make possible to download an article. However is still possible to print/export as pdf
        from any modern browsers.
    '''
    blob = bucket.blob('articles/'+aid+'/'+aid+'.md')
    server_path = blob.generate_signed_url(datetime.timedelta(seconds=999999999), method='GET')
    return {0:server_path}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def save_comment_edits(editor,aid,id,text,author):
    ''' save edits to a comment on the database. The edited comment is replaced by the new one. '''
    comment_ref = db.collection(u'articles').document(u'%s' % aid).collection('comments').document(u'%s' % author)
    comment = comment_ref.get()
    comment = comment.to_dict()
    comment[id]['text'] = text
    comment[id]['editor'] = editor
    date = datetime.datetime.now()
    comment[id]['date_edit'] = date.strftime('%d/%m/%y')
    comment[id]['time_edit'] = date.strftime('%H:%M:%S')
    comment_ref.set(comment,merge=True)
    return {0:True}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def delete(uid,aid,id):
    ''' Delete a comment or article from the database and the storage.
        It doesn't work for competitions that already have submissions.
    '''
    if aid == id:
        art_ref = db.collection(u'articles').document(u'%s'%aid)
        art = art_ref.get()
        art = art.to_dict()
        if 'competition' in art:
            if len(list(art_ref.collection('submissions').stream())) > 0:
                return {'response':'competition_failed'}

        art_ref.delete()
        blobs = list(bucket.list_blobs())
        for blob in blobs:
            if 'articles/'+aid in blob.name:
                blob.delete()
        try:
            remove_from_archive(id)
        except:
            pass
        return{'response': 'article_deleted'}
    else:
        com_ref = db.collection(u'articles').document(u'%s'%aid).collection(u'comments').document(u'%s' % uid)
        com_ref.update({id: firestore.DELETE_FIELD})
        document = com_ref.get().to_dict()
        if document == {}:
            com_ref.delete()
        return {'response':'comment_deleted'}

# ----- ADMIN - TOOLS INTERACTIONS -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def approve_article(aid):
    ''' When a pending article or edit is approved the database reference is updated.
        If an edit to an article is approved, the edited article is merged with the edit.
    '''
    try:
        art_ref = db.collection(u'articles').document(u'%s' % aid)
        art = art_ref.get()
        art = art.to_dict()
        if 'edit_of' in art:
            edited_ref = db.collection(u'articles').document(u'%s' % art['edit_of'])
            edited_ref.set({'edit': {'editor':art['author'],'time':art['timestamp']},'content': art['content']},merge=True)
            if 'img' in art:
                edited_ref.set({'img':art['img']},merge=True)
            if 'resources' in art:
                edited_ref.set({'resources':art['resources'],'resources_ref':aid},merge=True)
            art_ref.delete()
        else:
            art_ref.set({'pending':False},merge=True)
        return {0:True}
    except:
        return {0:False}


@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def make_moderator(uid):
    try:
        db.collection(u'users').document(u'%s' % uid).set({'profile':{'badge':'Moderator'}},merge=True)
        return {0:True}
    except:
        return {0:False}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def ban_user(uid):
    try:
        db.collection(u'users').document(u'%s' % uid).set({'profile':{'badge':'Banned User'}},merge=True)
        return {0:True}
    except:
        return {0:False}

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def unban_user(uid):
    try:
        db.collection(u'users').document(u'%s' % uid).set({'profile':{'badge':'Novice'}},merge=True)
        a,b = set_user_badge_reputation(uid);
        return {0:True}
    except:
        return {0:False}

# ----- SEARCH ARCHIVE - TOOLS -----------------------------------------------------

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def update_search_archive():
    ''' Update users on the search archive for the search bar. '''
    df = pd.read_csv('search_archive/archive.csv')
    users_collection = db.collection(u'users').stream()
    for u in users_collection:
        try:
            if u.id not in list(df['ID']):
                user = u.to_dict()
                name = user['profile']['name'] + ' ' + user['profile']['surname']
                img = '999'
                if 'img' in user['profile']:
                    img = user['profile']['img']
                df1 = pd.DataFrame.from_dict({'ID':[u.id],'KIND':['user'],'VALUE':[name],'IMG':[img]})
                df = pd.concat([df,df1])
        except Exception:
            print(Exception)
    df = df.drop_duplicates(subset=['ID'],keep='last')
    df.to_csv('search_archive/archive.csv',index=False)

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def add_articles_archive(aid,article):
    ''' add new articles to the search archive for the search bar. '''
    df = pd.read_csv('search_archive/archive.csv')
    if aid not in list(df['ID']):
        title = article['title'].replace('"','').strip()
        df1 = pd.DataFrame.from_dict({'ID':[aid],'KIND':['article'],'VALUE':[title],'IMG':['999']})
        df = pd.concat([df,df1])
        df = df.drop_duplicates(subset=['ID'],keep='last')
        df.to_csv('search_archive/archive.csv',index=False)

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def add_to_archive(tuple_dict):
    ''' Add a tuple to the search archive '''
    df = pd.read_csv('search_archive/archive.csv')
    df1 = pd.DataFrame.from_dict(tuple_dict)
    df = pd.concat([df,df1])
    df = df.drop_duplicates(subset=['ID'],keep='last')
    df.to_csv('search_archive/archive.csv',index=False)

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def remove_from_archive(id):
    ''' remove a tuple from the search archive '''
    df = pd.read_csv('search_archive/archive.csv')
    to_del = list(df.loc[df['ID']==id].index)[0]
    df = df.drop([to_del])
    df = df.drop_duplicates(subset=['ID'],keep='last')
    df.to_csv('search_archive/archive.csv',index=False)

@retry(wait_exponential_multiplier=1000, wait_exponential_max=3000, stop_max_delay=10000)
def amend_archive(tuple_dict,index):
    ''' modify a tuple from the search archive. '''
    df = pd.read_csv('search_archive/archive.csv')
    df = df.drop([index])
    add_to_archive(tuple_dict)

# triggers the update search archive every time the server re-start.
# update_search_archive()

def update_container():
    df = pd.DataFrame()
    users_collection = db.collection(u'users').stream()
    articles_collection = db.collection(u'articles').stream()
    for u in users_collection:
        user = u.to_dict()
        if 'name' in user['profile'] and 'surname' in user['profile']:
            name = user['profile']['name'] + ' ' + user['profile']['surname']
            img = '999'
            if 'img' in user['profile']:
                img = user['profile']['img']
            df1 = pd.DataFrame.from_dict({'ID':[u.id],'KIND':['user'],'VALUE':[name],'IMG':[img]})
            df = pd.concat([df,df1])
    for a in articles_collection:
        a_dict = a.to_dict()
        article = get_article(a.id)
        df1 = pd.DataFrame.from_dict({'ID':[a.id],'KIND':['article'],'VALUE':[article['title']],'IMG':['999']})
        df = pd.concat([df,df1])
        if article['competition'] == True and 'comp_resources' in a_dict:
            zipPath = a_dict['comp_resources']
            r = requests.get(zipPath, stream = True)
            if os.path.exists('comp_folder/%s' % a.id):
                shutil.rmtree('comp_folder/%s' % a.id)
            with open("comp_folder/%s.zip" % a.id, "wb") as zipFile:
                for chunk in r.iter_content(chunk_size=1024):
                    if chunk:
                        zipFile.write(chunk)
            shutil.unpack_archive('comp_folder/%s.zip' % a.id,'comp_folder','zip')

    df.to_csv('search_archive/archive.csv',index=False)
    