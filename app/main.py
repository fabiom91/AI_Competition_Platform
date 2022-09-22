# ----- IMPORTS and STUFFS -------------------------------------------------------
from flask import Flask, request, jsonify, render_template, flash, redirect, url_for, send_file, send_from_directory, abort, session
from flask_cors import cross_origin
from werkzeug.utils import secure_filename, safe_join
from werkzeug.exceptions import HTTPException, BadGateway
import werkzeug
import requests
import os
import sys
import json
import shutil
from zipfile import ZipFile
import random
import datetime
import time
import pandas as pd
import numpy as np
import subprocess
import logging


# ----- SERVER APP CONFIGURATION -----------------------------------------------------
# tells te app where to find pandoc on the server.
# comment this or replace it with your pandoc folder when testing locally
# PANDOC is the library for converting Markdown to Html.
os.environ.setdefault('PYPANDOC_PANDOC','/usr/bin/pandoc')

# include the folder "Services" that hosts all Firebase requests.
# import Services/myFirebase.py
sys.path.insert(1,'services')
import myFirebase

# TEMP_FOLDER, temporarily stores articles md files, images and resources and comp submissions until the files are uploaded to the firebase storage.
# COMP_FOLDER, stores competitions datasets on the server definitively
# NB: files from comp_folder are not deleted automatically when a competition is deleted.
TEMP_FOLDER = 'temp'
COMP_FOLDER = 'comp_folder'

# Initialize application
app = Flask(__name__)
app.secret_key=b'XXXXXXX'
app.config['TEMP_FOLDER'] = TEMP_FOLDER
app.config['COMP_FOLDER'] = COMP_FOLDER

# ----- DEBUG OPTIONS -----------------------------------------------------
app.config['DEBUG'] = False

# comment this in production to avoid logging
# if __name__ != '__main__':
#     gunicorn_logger = logging.getLogger('gunicorn.error')
#     app.logger.handlers = gunicorn_logger.handlers
#     app.logger.setLevel(gunicorn_logger.level)

# ----- LOAD TEMPLATES FUNCTIONS (WEB PAGES) -----------------------------------------
# Those functions route the client to the frontend pages stored in "templates" folder

# add landing page for testing
# @app.route("/")
# def route_landing(name=None):
#      return render_template('landing.html',name=name)

@app.route("/")
def route_home(name=None):
    return render_template('main.html',name=name)

@app.route("/dashboard.html")
def request_dashboard(name=None):
    return render_template('dashboard.html',name=name)

@app.route("/about.html")
def request_about(name=None):
    return render_template('about.html',name=name)

@app.route("/create_article.html")
def request_create_article(name=None):
    return render_template('create_article.html',name=name)

@app.route("/profile_view.html")
def route_profile(name=None):
    return render_template('profile_view.html',name=name)

@app.route("/read_article.html")
def read_article(name=None):
    return render_template('read_article.html',name=name)

@app.route("/admin.html")
def request_admin(name=None):
    return render_template('admin.html',name=name)

@app.route('/verify_email',methods=['GET'])
def verify_email(name=None):
    email = request.form['email']
    return render_template('verify_email.html', email=email, name=name)

# ----- PROFILE UPDATES --------------------------------------------------------------
# The following 2 functions are used to update the profile of a specific user
# and they are both called by the 3rd function: save_profile_changes
# which is a function called by the client with POST request.

def update_profile(uid,user_dict):
    ''' Argument : user profile as JSON dictionary
                   target user id (uid)

        call "update_profile" from Services/myFirebase.py
        to update the profile of the user identified by
        user ID (uid).
    '''
    user_dict = json.loads(user_dict)
    return myFirebase.update_profile(uid,user_dict)

def upload_profile_pic(uid,picture):
    ''' Argument file: image .jpg / .png

        Return True if the upload is successful. False otherwise.

        check save_profile_pic docstring in services/myFirebase.py
        for more info.
    '''
    ext = picture.filename[picture.filename.find('.'):]
    filename = secure_filename(uid + ext)
    picture.save(os.path.join(app.config['TEMP_FOLDER'],filename))
    while not os.path.isfile(os.path.join(app.config['TEMP_FOLDER'],filename)):
        time.sleep(1)
    return myFirebase.save_profile_pic(uid,filename)

@app.route("/save_profile_changes", methods = ['POST'])
def save_profile_changes():
    ''' Arguments: see update_profile and upload_profile_pic functions

        Return True if the save is successful. False otherwise.
    '''
    updated_profile = {}
    user_dict = request.form['user_dict']
    uid = request.form['uid']
    user = update_profile(uid,user_dict)
    try:
        picture = request.files['picture']
        re_picture = upload_profile_pic(uid,picture)
        updated_profile['picture_url'] = re_picture
    except:
        pass
    updated_profile['user'] = user
    return jsonify(updated_profile)

@app.route("/validate_MFA", methods = ['GET'])
@cross_origin()
def validate_MFA():
    pin = request.args['pin']
    code = request.args['code']
    response = requests.get('https://www.authenticatorApi.com/Validate.aspx', params={'Pin':pin, 'SecretCode':code})
    return response.text


# ----- ARTICLE PUBBLICATIONS / EDITS ------------------------------------------------
# ARTICLE: all the following 4 functions are called with an Ajax POST from the
# client side. The Ajax form contains a resource file which is temporarily
# stored into the TEMP_FOLDER, then sent to firebase storage by calling a
# specific function from services/myFirebase.py

@app.route("/upload_article_img", methods=['POST'])
def upload_article_img():
    ''' Argument file: image .jpg / .png

        Returns: {'exit':0} if the upload is successful.
        However the Return is not handled by the calling function in JS

        check save_article_img docstring in services/myFirebase.py
        for more info.
    '''
    articleID = request.form['articleID']
    orientation = request.form['orientation']
    picture = request.files['picture']
    ext = picture.filename[picture.filename.find('.'):]
    filename = secure_filename(articleID + ext)
    picture.save(os.path.join(app.config['TEMP_FOLDER'],filename))
    return jsonify(myFirebase.save_article_img(articleID,filename,orientation))

@app.route("/publish_article", methods=['POST'])
def publish_article():
    ''' Argument file: article as .md (markdown)
        file name = article ID

        Return {0:True} if successful.

        check save_article docstring in services/myFirebase.py
        for more info.
    '''
    article = request.form['article']
    articleID = request.form['articleID']
    authorID = request.form['uid']
    filename = articleID + '.md'
    temp_path = os.path.join(app.config['TEMP_FOLDER'],filename)
    with open(temp_path, 'w') as file:
        file.write(article)
    return jsonify(myFirebase.save_article(articleID,authorID,temp_path))

@app.route("/add_article_resource", methods=['POST'])
def add_article_resource():
    ''' Argument file: article resource file
        Can accept only one file at the time

        Return {'exit':0} if successful.

        check save_article_resources docstring in services/myFirebase.py
        for more info.
    '''
    articleID = request.form['articleID']
    file = request.files['file']
    filename = secure_filename(file.filename)
    file.save(os.path.join(app.config['TEMP_FOLDER'],filename))
    return jsonify(myFirebase.save_article_resources(articleID,filename))

@app.route('/edit_article',methods=['POST'])
def edit_article():
    edits = {
        "aid" : request.form['aid'],
        "uid" : request.form['uid'],
        "article" : request.form['article'],
        "temp_aid" : request.form['aid'] + '_' + str(int(datetime.datetime.now().timestamp())) + str(random.randint(10000,99999))
    }
    filename = edits['temp_aid'] + '.md'
    temp_path = os.path.join(app.config['TEMP_FOLDER'],filename)
    with open(temp_path, 'w') as file:
        file.write(edits["article"])
    edits['temp_path'] = temp_path
    try:
        picture = request.files['picture']
        ext = picture.filename[picture.filename.find('.'):]
        filename = secure_filename(edits['temp_aid'] + ext)
        picture.save(os.path.join(app.config['TEMP_FOLDER'],filename))
        edits["picture"] = filename
        edits["orientation"] = request.form['orientation']
    except:
        pass
    try:
        n_resources = int(request.form['n_resources'])
        edits['resources'] = []
        for i in range(n_resources):
            file = request.files['file_'+str(i)]
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['TEMP_FOLDER'],filename))
            edits['resources'].append(filename)
    except:
        pass
    return jsonify(myFirebase.edit_article(edits))

def make_archive(source, destination):
    base = os.path.basename(destination)
    name = base.split('.')[0]
    format = base.split('.')[1]
    archive_from = os.path.dirname(source)
    archive_to = os.path.basename(source.strip(os.sep))
    # print(source, destination, archive_from, archive_to)
    shutil.make_archive(name, format, archive_from, archive_to)
    shutil.move('%s.%s'%(name,format), destination)

@app.route("/add_comp_resources",methods=['POST'])
def add_comp_resources():
    ''' It accept multiple .csv files as competition resources.
        In each dataset given, the class to predict must be labelled
        as "class".

        It saves the resources into a subfolder named as the Article ID
        in the COMP_FOLDER. It also create a subfolder named "private"
        which contains the validation data. A new validation set is
        created with hidden class values for the user as a test set for
        his/her model.

        It also call the function add_comp from myFirebase.py in order to
        set the relevant competitions field into the article document
        in the firestore database.

        returns {'exit':0} if successful.

        check add_comp docstring in services/myFirebase.py
        for more info.
    '''
    try:
        files = []
        articleID = request.form['articleID']
        competition_type = request.form['competition_type']
        weighted_evas = json.loads(request.form['weighted_evas'])
        training = request.files['training_data']
        validation = request.files['validation_data']
        try:
            files.append(request.files['other_data'])
        except:
            pass
        try:
            files.append(request.files['description_data'])
        except:
            pass
        os.mkdir(app.config['COMP_FOLDER']+'/'+articleID)
        os.mkdir(app.config['COMP_FOLDER']+'/'+articleID+'/private')
        for i,file in enumerate(files):
            count = 1
            for j,file1 in enumerate(files):
                if file.filename == file1.filename and j < i:
                    name = file.filename[:file.filename.find('.')]
                    name += str(count)+'.csv'
                    file.filename = name
                    count += 1
        for file in files:
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['COMP_FOLDER']+'/'+articleID+'/',filename))
        training_name = secure_filename('training_set.csv')
        training.save(os.path.join(app.config['COMP_FOLDER']+'/'+articleID,training_name))
        validation_name = secure_filename('validation_set_private.csv')
        validation.save(os.path.join(app.config['COMP_FOLDER']+'/'+articleID+'/private',validation_name))
        df = pd.read_csv(app.config['COMP_FOLDER']+'/'+articleID+'/private/validation_set_private.csv')
        if df['class'].loc[df['class'].isna() == True].size > 0:
            shutil.rmtree(app.config['COMP_FOLDER']+'/'+articleID, ignore_errors=True)
            return {0:False}
        df['class'] = np.nan
        df1 = pd.read_csv(app.config['COMP_FOLDER']+'/'+articleID+'/training_set.csv')
        if df1['class'].loc[df1['class'].isna() == True].size > 0:
            shutil.rmtree(app.config['COMP_FOLDER']+'/'+articleID, ignore_errors=True)
            return {0:False}
        if df['class'].dtype != df1['class'].dtype:
            val_class = str(df['class'].dtype).lower()
            res_class = str(df1['class'].dtype).lower()
            if ("int" in val_class or "float" in val_class) and ("int" in res_class or "float" in res_class):
                pass
            else:
                shutil.rmtree(app.config['COMP_FOLDER']+'/'+articleID, ignore_errors=True)
                return {0:False}

        df.to_csv(app.config['COMP_FOLDER']+'/'+articleID+'/validation_set.csv',index=False)
        make_archive(app.config['COMP_FOLDER']+'/'+articleID, app.config['COMP_FOLDER']+'/'+articleID+'/comp_resources.zip')
        myFirebase.save_competition_resources(articleID)
        return jsonify(myFirebase.add_comp(articleID,weighted_evas,competition_type))
    except:
        shutil.rmtree(app.config['COMP_FOLDER']+'/'+articleID, ignore_errors=True)
        return {0:False}

@app.route('/save_edits',methods=['POST'])
def save_edits():
    ''' save the edits made to a COMMENT
        returns {0:True} if successful

        check save_comment_edits docstring in services/myFirebase.py
        for more info.
    '''
    editor = request.form['editor']
    aid = request.form['aid']
    id = request.form['id']
    comment_text = request.form['text']
    author = request.form['author']
    return jsonify(myFirebase.save_comment_edits(editor,aid,id,comment_text,author))


@app.route('/delete',methods=['POST'])
def delete():
    ''' Triggers the deletion from the database and the storage of
        an article or comment, identified by the "id" field.

        This operation is not allowed automatically for competitions that
        already have submission(s).

        check delete docstring in services/myFirebase.py
        for more info.
    '''
    uid = request.form['uid']
    aid = request.form['aid']
    id = request.form['id']
    return jsonify(myFirebase.delete(uid,aid,id))

@app.route('/close_competition',methods=['POST'])
def close_competition():
    ''' Closes the competition if not already closed.

        check close_competition docstring in services/myFirebase.py
        for more info.
    '''
    aid = request.form['aid']
    return jsonify(myFirebase.close_competition(aid))

# ----- ARTICLE READING --------------------------------------------------------------

@app.route('/approve_article',methods=['POST'])
def approve_article():
    ''' Argument: article id to approve (aid)

        return true if the request is successful, false otherwise.
        check get_article and approve_article docstrings in services/myFirebase.py
        for more info.
    '''
    aid = request.form['aid']
    return jsonify(myFirebase.approve_article(aid))

# NOTE: this next function is a bit obsolete and should be replaced. Currently is used by several other functions
# that's why is still mantained.
@app.route("/get_article",methods=['POST'])
def get_article():
    ''' fetch a formatted article for display in dashboard and cards from the database.
        It returns the article with title and text split if no "full" argument is
        given or the article with full text if otherwise.

        check get_article and get_full_article docstrings in services/myFirebase.py
        for more info.
    '''
    articleID = request.form['articleID']
    try:
        full = request.form['full_version']
        return jsonify(myFirebase.get_full_article(articleID))
    except:
        pass
    return jsonify(myFirebase.get_article(articleID))

@app.route("/get_all_articles",methods=['POST'])
def get_all_articles():
    ''' fetch all articles for display in dashboard.

        check get_all_articles docstring in services/myFirebase.py
        for more info.
    '''
    try:
        pending = request.form['pending']
    except:
        pending = False
    return jsonify(myFirebase.get_all_articles(pending))

@app.route("/get_comp_files",methods=['POST'])
def get_comp_files():
    ''' gets the files list of the competition
        to be displayed and downloaded by the user.

        check request_comp_file docstring in services/myFirebase.py
        for more info.
    '''
    articleID = request.form['articleID']
    return jsonify(myFirebase.request_comp_file(articleID))

@app.route("/download_file/<aid>/<name>")
def download_file(aid,name):
    ''' Download a single file from the competition directory'''
    path = os.path.join(app.config['COMP_FOLDER'],aid)
    try:
        return send_from_directory(directory=path, path=name, as_attachment=True)
    except FileNotFoundError:
        abort(404)

@app.route("/download_all_files/<aid>")
def download_all_files(aid):
    ''' Download all files from the competition directory in a zip format
        temporarily stored in the TEMP_FOLDER.

        see remove_downloaded_zip function below.
    '''
    path = os.path.join(app.config['COMP_FOLDER'],aid)
    zipName = aid + '_' + str(int(datetime.datetime.now().timestamp())) + str(random.randint(10000,99999)) + '.zip'
    exclude = [('private')]
    with ZipFile('%s/%s' % (app.config['TEMP_FOLDER'],zipName),'w')as zipObj:
        for folderName, subfolders, filenames in os.walk(path, topdown=True):
            subfolders[:] = [d for d in subfolders if d not in exclude]
            for filename in filenames:
                filePath = os.path.join(folderName,filename)
                zipObj.write(filePath)
    try:
        return send_from_directory(directory=app.config['TEMP_FOLDER'], path=zipName, as_attachment=True)
    except FileNotFoundError:
        abort(404)

@app.route("/remove_downloaded_zip",methods=['POST'])
def remove_downloaded_zip():
    ''' Remove a specific zip file from TEMP_FOLDER.
        Is called after download_all_files function to get rid
        of the temporary zip file created.
    '''
    zipName = ''
    aid = request.form['aid']
    dirlist = os.listdir(app.config['TEMP_FOLDER'])
    for f in dirlist:
        if aid in f:
            zipName = f
            break
    path = os.path.join(app.config['TEMP_FOLDER'],zipName)
    os.remove(path)
    # print('removed',zipName)
    return jsonify({'exit':0})

@app.route('/is_user_joined',methods=['POST'])
def is_user_joined():
    ''' Check if the user has already joined a given competition

        check is_user_joined docstring in services/myFirebase.py
        for more info.
    '''
    uid = request.form['uid']
    aid = request.form['aid']
    return jsonify(myFirebase.is_user_joined(uid,aid))

@app.route('/save_article',methods=['POST'])
def save_article():
    ''' Saves article bookmark reference for a given user in the firestore
        database.

        check save_article_bookmark docstring in services/myFirebase.py
        for more info.
    '''
    uid = request.form['uid']
    aid = request.form['aid']
    is_saved = request.form['is_saved']
    return jsonify(myFirebase.save_article_bookmark(uid,aid,is_saved))

@app.route('/check_if_saved',methods=['POST'])
def check_if_saved():
    ''' Check if an article bookmark has already been referenced to a given user.

        check check_if_saved docstring in services/myFirebase.py
        for more info.
    '''
    uid = request.form['uid']
    aid = request.form['aid']
    return jsonify(myFirebase.check_if_saved(uid,aid))

@app.route('/create_new_comment',methods=['POST'])
def create_new_comment():
    ''' Save a new comment to the firestore database as a field into the
        article document.

        check create_new_comment docstring in services/myFirebase.py
        for more info.
    '''
    comment = request.form['text']
    uid = request.form['uid']
    aid = request.form['aid']
    time = datetime.datetime.now()
    commentID = aid + '_' + str(int(datetime.datetime.now().timestamp())) + str(random.randint(10000,99999))
    return jsonify(myFirebase.create_new_comment(uid,aid,comment,time,commentID))

@app.route('/vote',methods=['POST'])
def vote():
    ''' Accept a up or down vote for a specific comment or article
        and save it to the database as a field in the article document.

        check vote docstring in services/myFirebase.py
        for more info.
    '''
    uid = request.form['uid']
    aid = request.form['aid']
    id = request.form['id']
    up_down = request.form['up_down']
    return jsonify(myFirebase.vote(aid,uid,id,up_down))

@app.route('/check_additional_resources',methods=['POST'])
def check_additional_resources():
    ''' Returns additional resources if any for a given article

        check get_additional_resources docstring in services/myFirebase.py
        for more info.
    '''
    aid = request.form['aid']
    # print(aid)
    return jsonify(myFirebase.get_additional_resources(aid))

@app.route('/get_article_download',methods=['POST'])
def get_article_download():
    ''' Return the downloadable file link of the article as md file

        check download_article docstring in services/myFirebase.py
        for more info.
    '''
    aid = request.form['aid']
    return jsonify(myFirebase.download_article(aid))

# NOTE: this next function is a bit obsolete and should be replaced. Currently is used by several other functions
# that's why is still mantained.
@app.route('/get_author_profile',methods=['POST'])
def get_author_profile():
    ''' Returns the author profile for a given article.

        check get_author_profile docstring in services/myFirebase.py
        for more info.
    '''
    aid = request.form['aid']
    return jsonify(myFirebase.get_author_profile(aid))

@app.route('/get_all_articles_lists',methods=['POST'])
def get_all_articles_lists():
    ''' returns all articles and submissions for a given author '''
    all_articles = {}
    try:
        articles = json.loads(request.form['articles_written'])
        all_articles['articles_written'] = get_articles_list2(articles)
    except:
        pass
    try:
        articles = json.loads(request.form['saved_articles'])
        all_articles['saved_articles'] = get_articles_list2(articles)
    except:
        pass
    try:
        uid = request.form['uid']
        competition_joined = json.loads(request.form['competition_joined'])
        submissions = myFirebase.get_submissions(uid,competition_joined)
        all_articles['submissions'] = submissions
    except:
        pass
    return jsonify(all_articles)

def get_articles_list2(articles):
    articles_list = []
    for a in articles:
        article = myFirebase.get_article(a)
        articles_list.append(article)
        while 'edit_of' in article:
            article = myFirebase.get_article(article['edit_of'])
        for i,art in enumerate(articles_list):
            if art['articleID'] == article['articleID']:
                articles_list[i] = myFirebase.get_article(a)
                break
    return articles_list

@app.route('/get_full_article',methods=['POST'])
def get_full_article():
    ''' Returns all info about an article, including collections such as
        comments and submissions.

        For each comment, submission and for the article iteself is also
        returned the author full name, and profile picture. The timestamp
        is used to engineer date and time fields.

        check get_article_full docstring in services/myFirebase.py
        for more info.
    '''
    aid = request.form['aid']
    return jsonify(myFirebase.get_article_full(aid))

# ----- JOIN COMPETITION / SUBMIT RESULTS --------------------------------------------

@app.route('/join_competition',methods=['POST'])
def join_competition():
    uid = request.form['uid']
    aid = request.form['aid']
    return jsonify(myFirebase.join_competition(uid,aid))


@app.route('/submit_comp_results',methods=['POST'])
def submit_comp_results():
    results = request.files['results']
    link = request.form['link']
    uid = request.form['uid']
    aid = request.form['aid']
    filename = secure_filename(results.filename)
    results.save(os.path.join(app.config['TEMP_FOLDER'],filename))
    return jsonify(myFirebase.submit_comp_results(uid,aid,filename,link))

@app.route('/update_leaderscore',methods=['POST'])
def update_leaderscore():
    uid = request.form['uid']
    aid = request.form['aid']
    position = request.form['position']
    total_participants = request.form['total_participants']
    subID = request.form['subID']
    return jsonify(myFirebase.update_leaderscore(uid,aid,position,total_participants,subID))

# ----- GET USER PROFILE -------------------------------------------------------------
# Also include admin priviledges

@app.route('/get_user',methods=['POST'])
def get_user():
    ''' Returns a snapshot of the original database entry for a given user '''
    uid = json.loads(request.form['uid'])
    try:
        email = request.form['email']
        return jsonify(myFirebase.get_user(uid,email))
    except:
        return jsonify(myFirebase.get_user(uid))

@app.route('/get_all_users',methods=['POST'])
def get_all_users():
    return jsonify(myFirebase.get_all_users())

@app.route('/make_moderator',methods=['POST'])
def make_moderator():
    uid = request.form['uid']
    return jsonify(myFirebase.make_moderator(uid))

@app.route('/ban_user',methods=['POST'])
def ban_user():
    uid = request.form['uid']
    return jsonify(myFirebase.ban_user(uid))

@app.route('/unban_user',methods=['POST'])
def unban_user():
    uid = request.form['uid']
    return jsonify(myFirebase.unban_user(uid))

@app.route('/create_new_user',methods=['POST'])
def create_new_user():
    uid = request.form['uid']
    email = request.form['email']
    return jsonify(myFirebase.create_new_user(uid,email))


# ----- RUN APP ----------------------------------------------------------------------
# The following functions are runned by the backend when the app run

@app.route('/load_search_archive',methods=['POST'])
def load_search_archive():
    ''' refresh the search bar of the app with new contents and delete old ones '''
    df = pd.read_csv('search_archive/archive.csv')
    archive_list = list(df.T.to_dict().values())
    return jsonify(archive_list)

# This function was used by the alpha test to limit access to staff only
@app.route('/test_pwd_verification',methods=['POST'])
def test_pwd_verification():
    pwd = request.form['pwd']
    if pwd == "Estate2020!":
        return jsonify({'response':True})
    return jsonify({'response':False})

@app.errorhandler(502)
def bad_request_handler(error):
    # print("502 ERROR CATCHED")
    bashCommand = "sudo service main restart"
    count = 0
    output = '_'
    while output != '' and count < 5:
        count += 1
        process = subprocess.Popen(bashCommand.split(), stdout=subprocess.PIPE, shell=True)
        output, error = process.communicate()
    flash(u"We are experiencing some high volume of requests, <strong>this page has been reloaded</strong>", "error")
    return render_template('dashboard.html',name=None)

# only for debug:
# @app.route('/recalculate_leaderscore',methods=['GET'])
# def recalculate_leaderscore():
#     return jsonify(myFirebase.recalculate_leaderscore())




if __name__ == "__main__":
    app.run(host='0.0.0.0', debug=False)
