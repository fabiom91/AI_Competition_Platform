var div_messages = parent.document.getElementById('bad_request_message');
div_messages.innerHTML = "";

function loadUID(){
  var uid = localStorage.getItem('_uid');
  if (!uid) return false;
  uid = atob(uid);
  uid = JSON.parse(uid);
  return uid;
}
function loadUSER_DATA(){
  var user_data = localStorage.getItem('_user_data');
  if (!user_data) return false;
  user_data = atob(user_data);
  user_data = JSON.parse(user_data);
  return user_data;
}
var USER_DATA = loadUSER_DATA();
function loadAID(){
  var articleID = localStorage.getItem('articleID');
  if (!articleID) return false;
  articleID = JSON.parse(articleID);
  // localStorage.removeItem('articleID');
  return articleID;
}
const UID = loadUID();
const AID = loadAID();
load_article();

function load_profile(id){
  $.post('/get_user',{'uid':JSON.stringify(id)}).done(function(user_data){
    cached_user = JSON.stringify(user_data);
    cached_user = btoa(cached_user);
    cached_uid = JSON.stringify(id);
    cached_uid = btoa(cached_uid);
    localStorage.setItem('_otherID',cached_uid);
    localStorage.setItem('_other_user_data',cached_user);
    parent.load_feed('profile_view');
  });
}


$(document).ready(function(){
  var article_votes_btns = document.getElementById('article_votes_btns');
  article_votes_btns.innerHTML = "<i class='fas fa-caret-up fa-3x' onclick='vote(\""+AID+"\",\"up\")'></i><h3 class='nomargin' id='votes_"+AID+"'>0</h3><i class='fas fa-caret-down fa-3x' onclick='vote(\""+AID+"\",\"down\")'></i>"
  var download_article_btn = document.getElementById('download_article_btn');
  $.post('/get_article_download',{'aid':AID}).done(function(url){
    url = url[0];
    download_article_btn.setAttribute('href',url);
  });
});

function load_article(){
  var loading_bar = window.top.document.getElementById('loading_bar');
  loading_bar.setAttribute('aria-valuenow',25);
  loading_bar.style.width = '25%';
  $.post('/get_full_article',{'aid':AID}).done(function(article){
    loading_bar.setAttribute('aria-valuenow',50);
    loading_bar.style.width = '50%';
    if (UID && USER_DATA){
      if (article['main']['authorID']==UID || USER_DATA['profile']['badge'] == 'Admin' || USER_DATA['profile']['badge'] == 'Moderator'){
        load_author_priviledges();
      }
      if (USER_DATA['profile']['badge'] == 'Admin' || USER_DATA['profile']['badge'] == 'Moderator'){
        if (article['main']['pending'] && article['main']['pending'] == true){
          load_admin_priviledges();
        }
      }
      if (USER_DATA['saved_articles'] && USER_DATA['saved_articles'].includes(AID)){
        var save_bookmark_btn = document.getElementById('save_btn');
        save_bookmark_btn.innerHTML = "Remove Bookmark <i class='fas fa-bookmark fa-lg'></i>";
        save_bookmark_btn.setAttribute('href','javascript: save_article('+true+')');
      } else {
        var save_bookmark_btn = document.getElementById('save_btn');
        save_bookmark_btn.innerHTML = "Add Bookmark <i class='far fa-bookmark fa-lg'></i>";
        save_bookmark_btn.setAttribute('href','javascript: save_article('+false+')');
      }
    }
    var article_frame = document.getElementById('article_frame');
    article_frame.style.position = 'relative';
    article['main']['full_text'] = DOMPurify.sanitize(article['main']['full_text'], {ALLOW_UNKNOWN_PROTOCOLS: true});
    var temp_frame = '<link rel="stylesheet" type="text/css" href="../static/styles/main.css"><link rel="stylesheet" type="text/css" href="../static/styles/read_article.css"><link href="https://fonts.googleapis.com/css?family=Noto+Serif:400,400i,700,700i&display=swap" rel="stylesheet"><link rel="stylesheet" type="text/css" href="../static/styles/pandoc.css">';
    if (article['main']['img']){
      var url = article['main']['img']['url'];
      var orientation = article['main']['img']['orientation'];
      if (orientation == 'landscape'){
        temp_frame += "<img style='max-width:100%;margin:0 auto;' src="+url+" alt='article_img'>";
      } else if (orientation == 'portrait') {
        temp_frame += "<img style='max-width:100%;max-height:600px;margin:0 auto;' src="+url+" alt='article_img'>";
      }
    }
    temp_frame += article['main']['full_text'];
    if (article['main']['edit']){
      temp_frame += "<div class='container' style='float:right;padding:50px 20px 20px 0;text-align:right;'>";
      temp_frame += "<h3 >Date written: "+article['main']['date']+"</h3>";
      temp_frame += "<ul><li><h4 style='margin:0;margin-right:20px'><strong>Edited by:</strong><br>"+article['main']['edit']['editor']+"<br>"+article['main']['edit']['date']+" at: "+article['main']['edit']['time']+"</h4></li><li><a href='javascript: window.parent.load_profile(\""+article['main']['edit']['editorID']+"\")'><img src="+article['main']['edit']['editorImg']+" style='height:60px;width:60px;border-radius: 100%;clip-path: circle(60px at center);'></a></li><ul>";
      temp_frame += "</div>";
    } else {
      temp_frame += "<h4 style='float:right;padding:50px 20px 20px 0'>Date written: "+article['main']['date']+"</h4>"
    }
    article_frame.srcdoc = temp_frame;
    if (!article['main']['competition'] || article['main']['competition']==false){
      document.getElementById('competition_div').style.display = 'none';
      document.getElementById('competition_scroll_btn').style.display='none';
    } else {
      if (article['main']['competition_closed'] && article['main']['competition_closed'] == true){
        document.getElementById('closed_comp_disclaimer').style.display='inline-block';
        document.getElementById('join_comp_btn').disabled = true;
        document.getElementById('submit_results_btn').disabled = true;
      } else {
        document.getElementById('closed_comp_disclaimer').style.display='none';
      }
      let files = article['comp_files'];
      var table = document.getElementById('data_downloads_table');
      var temp_table = "<tr><th>Data</th><th>Format</th><th>Size</th><th>Dimensions</th></tr>";
      for (var i=0; i<files.length; i++){
        var name = files[i]['name'];
        var format = files[i]['format'];
        var size = files[i]['size'];
        var dimensions = files[i]['dimensions'];
        temp_table += "<tr><td>"+name+"</td><td>"+format+"</td><td>"+size+"</td><td>"+dimensions+"</td><td><a href='/download_file/"+AID+"/"+name+"' target='_blank'><i class='fas fa-file-download fa-2x'></i></td></tr>";
      }
      table.innerHTML = temp_table;
      if (article['main']['authorID'] == UID){
        var close_comp_div = document.getElementById('close_comp_div');
        close_comp_div.innerHTML = "<button id='close_competition_btn' class='admin_button' type='submit' name='button'  style='color:red' onclick='close_competition()'><i class='fas fa-times' style='margin-right:10px'></i>Close Competition</button>";
        document.getElementById('close_competition_btn').style.display = 'inline-block';
      }
      if (UID && UID != false){
        $.post('/is_user_joined',{'uid':UID,'aid':AID}).done(function(bool){
          if (bool == false){
            document.getElementById('submit_results_btn').disabled = true;
          } else if (bool == true) {
            document.getElementById('join_comp_btn').style.backgroundColor = 'grey';
          }
        });
      } else {
        document.getElementById('submit_results_btn').disabled = true;
        document.getElementById('join_comp_btn').disabled = true;
      }
      if (article['submissions'] && article['submissions'].length > 0){
        populate_leaderboard(article['main']['authorID'],article['submissions'],article['sub_profiles']);
      }
    }
    if (article['comments'] && article['comments'].length > 0){
      display_all_comments(article['comments'],article['com_profiles']);
    }
    if (article['main']['resources_ref']){
      check_additional_resources(article['main']['resources_ref']);
    } else {
      check_additional_resources(AID);
    }
    load_article_footer();
    loading_bar.setAttribute('aria-valuenow',100);
    loading_bar.style.width = '100%';
  });
}



function load_author_priviledges(){
  var priviledges = document.getElementById('priviledges');
  priviledges.innerHTML += "<div class='row' align='center' id='author_priviledges'><div class='col' align='right'><button id='edit_article_btn' class='admin_button' type='submit' name='button'><i class='fas fa-pencil-alt' style='margin-right:10px'></i>Edit Article</button></div><div class='col' align='left'><button id='delete_article_btn' class='admin_button' type='submit' name='button' style='color:red'><i class='fas fa-pencil-alt' style='margin-right:10px'></i>Delete Article</button></div></div>";
  document.getElementById('author_priviledges').style.display = 'flex';
  var edit_btn = document.getElementById('edit_article_btn');
  var delete_btn = document.getElementById('delete_article_btn');
  edit_btn.setAttribute('onclick',"edit('"+AID+"')");
  delete_btn.setAttribute('onclick',"delete_element('"+AID+"')");
}

function load_admin_priviledges(){
  var priviledges = document.getElementById('priviledges');
  priviledges.innerHTML += "<div class='row' align='center' id='admin_priviledges'><div class='col'><button id='approve_article_btn' class='admin_button' type='submit' name='button' style='color:green'><i class='fas fa-crown' style='margin-right:10px'></i>Approve Article</button></div></div>";
  document.getElementById('admin_priviledges').style.display = 'flex';
  var approve_article_btn = document.getElementById('approve_article_btn');
  approve_article_btn.setAttribute('onclick',"approve('"+AID+"')");
}

function load_article_footer(){
  $.post('/get_author_profile',{'aid':AID}).done(function(author){
    var name_qualifications = document.getElementById('author_name_qualifications');
    var contacts = document.getElementById('author_contacts');
    var author_pic = document.getElementById('author_pic');
    author_pic.setAttribute('src',author['img']);
    author_pic.setAttribute('onclick', "load_profile('"+author['authorID']+"')");
    var temp = "<p><strong>"+author['full_name']+"</strong></p>";
    temp += "<p>"+author['qualifications']+"</p></div><div class='col-md-2 contacts my-auto'>";
    name_qualifications.innerHTML = temp;
    contacts.innerHTML = "<p>"+author['email']+"</p><p>"+author['phone']+"</p></div>";
  });
}

function check_additional_resources(id){
  var resources_list = document.getElementById('resources_list');
  $.post('/check_additional_resources',{'aid':id}).done(function(resources){
    if (Object.keys(resources).length > 0){
      var keys = Object.keys(resources);
      resources_list.innerHTML = "<h4>Downloadable Resources:</h4><ul>"
      for (var i=0; i<keys.length; i++){
        resources_list.innerHTML += "<li style='list-style-type:none; padding-right:10px'><a href='"+resources[keys[i]]+"' target='_blank'><i class='fas fa-file-download fa-lg' style='margin-right:10px'></i>"+keys[i]+"</a></li>";
      }
      resources_list.innerHTML += "</ul>"
    }
  });
}

let iframe = document.querySelector('#article_frame');
iframe.addEventListener('load',function(event){
  var article_frame = document.getElementById('article_frame');
  var article_feed = document.getElementById('article_feed');
  article_frame.height = article_frame.contentWindow.document.body.scrollHeight + 400;
  article_feed.style.height = (article_frame.height).toString() + 'px';
  article_feed.style.overflow = 'hidden';

  var download_all_btn = document.getElementById('download_all_btn');
  download_all_btn.setAttribute('href','/download_all_files/'+AID);
  download_all_btn.setAttribute('onclick','remove_zip_file()');
  document.getElementById('join_comp_btn').setAttribute('onclick','join_competition()');
  document.getElementById('submit_results_btn').setAttribute('onclick','submit_results()');
  var feeds_frame = window.parent.document.getElementById('feeds_frame');
  feeds_frame.style.height = (document.documentElement.scrollHeight).toString() + 'px';
});

function remove_zip_file(){
  $.post('/remove_downloaded_zip',{'aid':AID});
}

function join_competition(){
  if (checkLogin) {
    if (document.getElementById('submit_results_btn').disabled == false){
      alert('You already joined this competition, please, submit your results when you are ready.');
    } else {
      $.post('/join_competition',{'uid':UID,'aid':AID}).done(function(bool){
        if(bool == true){
          document.getElementById('submit_results_btn').disabled = false;
          document.getElementById('join_comp_btn').style.backgroundColor = 'grey';
          alert('Thank you for joining the competition. Please, submit your results when you are ready.');
        } else {
          alert('Sorry. Something went wrong, try again later. :(');
        }
      });
    }
  } else {
    alert("You must be a logged user to join a competition.")
  }
}

function submit_results(){
  $('#submit_results_modal').modal();
  scroll_page('submit_results_modal');
}

function saveSubmission(){
  let results = $('#upload_results').prop('files')[0];
  let link = document.getElementById('upload_link').value;
  if (link=='' || results == null){
    alert('Error: all fields are required. Please upload your results and provide a valid link to your code.');
  } else {
    let accepted_csv_formats = ['application/vnd.ms-excel','text/plain','text/csv','text/tsv'];
    if (results['size']<=20000000 && accepted_csv_formats.includes(results['type'])){
      var form = new FormData();
      form.append('results',results);
      form.append('link',link);
      form.append('uid',UID);
      form.append('aid',AID);
      $.ajax({
        url:"/submit_comp_results",
        data:form,
        type:'POST',
        contentType:false,
        processData:false,
      }).done(function(re){
        if (re == true){
          alert('Thank you for your submission! To edit your current submission, upload a new one.');
          $('#submit_results_modal').modal('hide');
          id = JSON.stringify(AID);
          localStorage.setItem('articleID',id);
          parent.load_feed('read_article');
        } else if (re["Error"]){
            alert("Something went wrong :(\n\n"+re['Error']+"\n\nPlease also make sure that your submission satisfy the requirements:\n\u2022 The submission does NOT contain null values;\n\u2022 The predicted feature is named: 'class' (lowercase);\n\u2022 If your submission does not follow the order of the validation set, it has to match its index;\n\u2022 Some of the evaluation measures are out of their normal range;\n\u2022 The predicted class data-type match the class of the Training/Validation dataset.");
        } else {
            alert("Something went wrong :(\n\nPlease make sure that your submission satisfy the requirements:\n\u2022 The submission does NOT contain null values;\n\u2022 The predicted feature is named: 'class' (lowercase);\n\u2022 If your submission does not follow the order of the validation set, it has to match its index;\n\u2022 Some of the evaluation measures are out of their normal range;\n\u2022 The predicted class data-type match the class of the Training/Validation dataset.");
        }
      }).catch(function(re){
        alert('Something went wrong, try again. :(');
      });
    } else {
      alert('The only file allowed is CSV with size: less than or equal to 20Mb');
    }
  }
}


function save_article(is_saved){
  if (checkLogin()){
    $.post('/save_article',{'aid':AID,'uid':UID,'is_saved':is_saved}).done(function(re){
      if (re[0] == true){
        var save_bookmark_btn = document.getElementById('save_btn');
        save_bookmark_btn.innerHTML = "Remove Bookmark <i class='fas fa-bookmark fa-lg'></i>";
        save_bookmark_btn.setAttribute('href','javascript: save_article('+true+')');
      } else {
        var save_bookmark_btn = document.getElementById('save_btn');
        save_bookmark_btn.innerHTML = "Add Bookmark <i class='far fa-bookmark fa-lg'></i>";
        save_bookmark_btn.setAttribute('href','javascript: save_article('+false+')');
      }
    });
  } else {
    alert("You must be a logged user to save a bookmark.");
  }
}

function close_competition(){
  var confirmation = confirm('WARNING: This operation is irreversible. Once the competition has been closed, it will still be visible to the public but no further submissions will be allowed. If any submission presents at the closing time, you have a duty to assess them and assign eventual prizes. You can get in contact directly with each partecipant in private or via comment on the competition itself.');
  if (confirmation == true) {
    $.post('/close_competition',{'aid':AID}).done(function(re){
      if (re['response'] == 'success'){
        alert('Your competition has been successfully closed. Please check the leaderboard and contact the winner(s)! :D');
        document.getElementById('join_comp_btn').disabled = true;
        document.getElementById('submit_results_btn').disabled = true;
        document.getElementById('closed_comp_disclaimer').style.display = 'inline-block';
      } else if (re['response'] == 'already_closed') {
        alert('This competition has been already closed. Please check the leaderboard and contact the winner(s)! :D');
      }
    });
  }
}


function showhide_newcomment() {
  alert("This function has been temporarily disabled. For questions and support, please contact airesearch.platform@gmail.com")
  // if (checkLogin()==false){
  //   alert("You must be a logged user to post a new comment.");
  // }
  // if (UID){
  //   var btn = document.getElementById('writecomment_btn');
  //   var comment = document.getElementById('new_comment');
  //   if (comment.style.display == 'none') {
  //     comment.style.display = 'flex';
  //     btn.style.display = 'none';
  //     var feeds_frame = window.parent.document.getElementById('feeds_frame');
  //     feeds_frame.style.height = (document.documentElement.scrollHeight).toString() + 'px';
  //   } else {
  //     var height = comment.scrollHeight;
  //     comment.style.display = 'none';
  //     btn.style.display = 'block';
  //     var feeds_frame = window.parent.document.getElementById('feeds_frame');
  //     feeds_frame.style.height = (document.documentElement.scrollHeight - height).toString() + 'px';
  //   }
  // }
}

  //radar
  function generate_chart(){
    var charts = document.getElementsByClassName('chart');
    Array.prototype.forEach.call(charts, function(canvas) {
      var chartID = canvas.id;
      var last_scores = charts_dict[chartID]['last_submission'];
      var best_scores = charts_dict[chartID]['best_submission'];
      var all_scores = Object.keys(last_scores).concat(Object.keys(best_scores));
      var max_value = Math.max.apply(null,all_scores);
      max_value = Math.ceil(max_value);
      var ctxR = canvas.getContext('2d');
      var myRadarChart = new Chart(ctxR, {
        type: 'radar',
        data: {
          labels: Object.keys(last_scores),
          datasets: [
            {
              label: "Your Last Score",
              data: Object.values(last_scores),
              backgroundColor: ['rgba(105, 0, 132, .2)',],
              borderColor: ['rgba(200, 99, 132, .7)',],
              borderWidth: 2
            },{
              label: "Your Best Score",
              data: Object.values(best_scores),
              backgroundColor: ['rgba(0, 250, 220, .2)',],
              borderColor: ['rgba(0, 213, 132, .7)',],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: false,
          // scale: {
          //   ticks: {
          //     beginAtZero: true,
          //     max: max_value
          //   }
          // }
        }
      });
    });
  }

  var charts_dict = {};
  function populate_leaderboard(authorID,submissions,profiles){
    var leaderboard_div = document.getElementById('leaderboard_feed');
    leaderboard_div.innerHTML = '';
    var scores_dict = {};
    var last_submissions = {};
    var best_submissions = {};
    var best_submissionIDs = {};
    var code_links = {};
    for (var i=0; i<submissions.length; i++){
      var sub_user = submissions[i];
      for (var k=0; k<Object.keys(sub_user).length; k++){
        sub = sub_user[Object.keys(sub_user)[k]];
        if (!code_links[sub['author']]){
          code_links[sub['author']] = {};
        }
        if (scores_dict[sub['author']]){
          if (scores_dict[sub['author']] < sub['weighted_score']){
            scores_dict[sub['author']] = sub['weighted_score'];
            best_submissions[sub['author']] = sub['scores'];
            best_submissionIDs[sub['author']] = Object.keys(sub_user)[k];
            code_links[sub['author']]['best_submission'] = sub['code_link'];
          }
        } else {
          scores_dict[sub['author']] = sub['weighted_score'];
          best_submissions[sub['author']] = sub['scores'];
          best_submissionIDs[sub['author']] = Object.keys(sub_user)[k];
          code_links[sub['author']]['best_submission'] = sub['code_link'];
        }
        last_submissions[sub['author']] = sub['scores'];
        code_links[sub['author']]['last_submission'] = sub['code_link'];
      }
    }


    const lead_array = Object.entries(scores_dict).sort(([,a], [,b]) => b-a).map(([p]) => p);

    let medals = {
      1 : 'Gold Medal',
      2 : 'Silver Medal',
      3 : 'Bronze Medal'
    }

    for (var i=0; i<lead_array.length; i++){
      var medal = '';
      var u = lead_array[i];
      var position = i+1;
      if (i>0 && scores_dict[u] == scores_dict[lead_array[i-1]]) {
        position = position-1;
      }

      if (!code_links[u]['best_submission']){
        code_links[u]['best_submission'] = code_links[u]['last_submission'];
      }
      medal = medals[position]
      var temp_feed = '';
      temp_feed += "<div class='horiz_line'></div><div class='row centered'>"
      temp_feed += "<div class='col'><img class='profile_picture_leaderboard nomargin' src='"+profiles[u]['profile']['img']+"' alt='profile_picture'>";
      temp_feed += "<p class='nomargin'>"+profiles[u]['profile']['name']+" "+profiles[u]['profile']['surname']+"</p></div><div class='col' align='center'>";
      temp_feed += "<canvas class='chart' id='"+u+"'></canvas></div><div class='col'>";
      temp_feed += "<p>"+position+" of "+lead_array.length+" on the <strong>Public</strong> Leaderboard</p>";
      temp_feed += "<h3>"+medal+"</h3><div class='progress'>";

      var total = lead_array.length;
      $.post('/update_leaderscore',{'uid':u,'aid':AID,'position':position,'total_participants':total,'subID':best_submissionIDs[u]});
      var delta = total - (position-1);
      if (delta == 0){
        delta += 0.1;
      }
      var progress = Math.round((delta / lead_array.length) * 100);
      temp_feed += "<div class='progress-bar' role='progressbar' style='width:"+progress+"%' aria-valuenow='"+progress+"' aria-valuemin='0' aria-valuemax='100'></div></div>";
      if (UID == authorID || UID == u || USER_DATA && ( USER_DATA['profile']['badge'] == 'Admin' || USER_DATA['profile']['badge'] == 'Moderator')){
        temp_feed += "<form action='"+code_links[u]['best_submission']+"' method='get' target='_blank'><button style='font-size:70%; margin-top:10px;'>Download Best Submission <i class='fas fa-cloud-download-alt'></i></button></form>";
        if (code_links[u]['last_submission'] != code_links[u]['best_submission']){
          temp_feed += "<form action='"+code_links[u]['last_submission']+"' method='get' target='_blank'><button style='font-size:70%; margin-top:10px;'>Download Last Submission <i class='fas fa-cloud-download-alt'></i></button></form>";
        }
      }
      temp_feed += "</div></div>";
      leaderboard_div.innerHTML += temp_feed;
      charts_dict[u] = {'last_submission':last_submissions[u],'best_submission':best_submissions[u]};
      // generate_chart(u,last_submissions[u],best_submissions[u]);
    }
    generate_chart();
  }


  function show_hide_div(toShow) {
    var divs = ['data_downloads','leaderboard'];
    document.getElementById('data_downloads').style.display = 'flex';
    document.getElementById('leaderboard').style.display = 'flex';
    var download_height = document.getElementById('data_downloads').scrollHeight;
    var leader_height = document.getElementById('leaderboard').scrollHeight;
    document.getElementById('data_downloads').style.display = 'none';
    document.getElementById('leaderboard').style.display = 'none';
    for (var i=0; i<divs.length; i++) {
      if (divs[i] == toShow) {
        var feeds_frame = window.parent.document.getElementById('feeds_frame');
        var feeds_height_str = feeds_frame.style.height;
        var feeds_height = parseInt(feeds_height_str.substring(0,feeds_height_str.length -2));
        if (toShow == 'leaderboard'){
          feeds_frame.style.height = (feeds_height - download_height + leader_height).toString() + 'px';
          document.getElementById('option2').disabled = true;
          document.getElementById('option1').disabled = false;
        } else {
          feeds_frame.style.height = (feeds_height - leader_height + download_height).toString() + 'px';
          document.getElementById('option1').disabled = true;
          document.getElementById('option2').disabled = false;
        }
        document.getElementById(divs[i]).style.display = 'flex';
      } else {
        document.getElementById(divs[i]).style.display = 'none';
      }
    }
  }

  function read_all(comment) {
    var com = document.getElementById(comment);
    var com_class = com.className;
    if (com_class == 'col overflow-hidden'){
      com.className = 'col overflow-auto';
      com.style.maxHeight = '600px';
      var feeds_frame = window.parent.document.getElementById('feeds_frame');
      feeds_frame.style.height = (document.documentElement.scrollHeight).toString() + 'px';
    } else {
      var height = com.scrollHeight;
      com.className = 'col overflow-hidden';
      com.style.maxHeight = '100px';
      var feeds_frame = window.parent.document.getElementById('feeds_frame');
      feeds_frame.style.height = (document.documentElement.scrollHeight - height).toString() + 'px';
    }

  }

  function save_comment(){
    comment = document.getElementById('comment').value;
    $.post('/create_new_comment', {'text':comment,'uid':UID,'aid':AID}).done(function(formatted_comment){
      display_comment(formatted_comment);
      comment.value = '';
      showhide_newcomment();
    });
  }

  function compare(a, b) {
    const bandA = a.time;
    const bandB = b.time;

    let comparison = 0;
    if (bandA > bandB) {
      comparison = 1;
    } else if (bandA < bandB) {
      comparison = -1;
    }
    return comparison;
  }

  function display_all_comments(comments_all,profiles){
    document.getElementById('comments_feed').innerHTML='';
    var comments_list = [];
    for (var j=0; j<comments_all.length; j++){
      comments = comments_all[j]
      for (var i=0; i<Object.keys(comments).length; i++){
        var com = comments[Object.keys(comments)[i]];
        var authorID =  com['author'];
        formatted_comment = {
          'author_fullName' : profiles[authorID]['profile']['name'] + ' ' + profiles[authorID]['profile']['surname'],
          'author_pic' : profiles[authorID]['profile']['img'],
          'text' : com['text'],
          'time' : com['time'],
          'votes' : com['votes'],
          'authorID' : authorID,
          'date_created' : com['date_created'],
          'time_created' : com['time_created'],
          'id': Object.keys(comments)[i],
          'editorID' : com['editor'],
          'editor_fullName' : com['editor_fullName'],
          'date_edit': com['date_edit'],
          'time_edit':com['time_edit']
        }
        comments_list.push(formatted_comment);
      }
    }
    comments_list = comments_list.sort(compare);
    for (var i=0; i<comments_list.length; i++){
      display_comment(comments_list[i]);
    }
  }

  function display_comment(formatted_comment){
    var comments_feed = document.getElementById('comments_feed');
    var author = formatted_comment['author_fullName'];
    var pic = formatted_comment['author_pic'];
    var text = formatted_comment['text'];
    var date = formatted_comment['time'];
    var votes = formatted_comment['votes'];
    var authorID = formatted_comment['authorID'];
    var date_created = formatted_comment['date_created'];
    var time_created = formatted_comment['time_created'];
    var id = formatted_comment['id'];
    var temp_feed = "<div class='row'><div class='col-md-2 small-card'><a href='javascript:load_profile(\""+authorID+"\")'><img class='profile_picture_leaderboard nomargin' src='"+pic+"' alt='profile_picture'></a></div>";
    temp_feed += "<div id='"+id+"' class='col overflow-hidden' style='text-align:justify;max-height:200px;' onclick='read_all(\""+id+"\")'>";
    temp_feed += "<p><strong>"+author+"</strong></p><p id='c_text_"+id+"'></p>";
    if (formatted_comment['editorID']){
      var editorID = formatted_comment['editorID'];
      var editor = formatted_comment['editor_fullName'];
      var date_edit = formatted_comment['date_edit'];
      var time_edit = formatted_comment['time_edit'];
      temp_feed += "<div class='container' style='position:absolute,bottom:0,float:right;padding:50px 20px 20px 0;text-align:right;'>";
      temp_feed += "<h4 >Date written: "+date_created+" at: "+time_created+"</h4>";
      temp_feed += "<h4><strong>Edited by: </strong><a href='javascript:load_profile(\""+editorID+"\")'>"+editor+"</a> "+date_edit+" at: "+time_edit+"</h4></li><ul>";
      temp_feed += "</div>";
    } else {
      temp_feed += "<h4 style='float:right;padding:50px 20px 20px 0'>Date written: "+date_created+" at: "+time_created+"</h4>"
    }
    temp_feed += "</div><div class='col-md-1'><i class='fas fa-caret-up fa-3x' onclick='vote(\""+id+"\",\"up\")'></i><h3 class='nomargin' id='votes_"+id+"'>"+votes+"</h3><i class='fas fa-caret-down fa-3x' onclick='vote(\""+id+"\",\"down\")'></i></div></div>";
    if (UID && USER_DATA){
      if (UID == authorID){
        temp_feed += "<div class='row' align='center'><div class='col' align='right'><button class='admin_button' type='submit' name='button' onclick='edit(\""+id+"\")'><i class='fas fa-pencil-alt' style='margin-right:10px'></i>Edit Comment</button></div><div class='col' align='left'><button class='admin_button' type='submit' name='button' style='color:red' onclick='delete_element(\""+id+"\")'><i class='fas fa-pencil-alt' style='margin-right:10px'></i>Delete Comment</button></div></div>";
      } else if (USER_DATA['profile']['badge'] == 'Admin' || USER_DATA['profile']['badge'] == 'Moderator') {
        temp_feed += "<div class='row' align='center'><div class='col' align='right'><button class='admin_button' type='submit' name='button' onclick='edit(\""+id+"\",\""+authorID+"\")'><i class='fas fa-pencil-alt' style='margin-right:10px'></i>Edit Comment</button></div><div class='col' align='left'><button class='admin_button' type='submit' name='button' style='color:red' onclick='delete_element(\""+id+"\",\""+authorID+"\")'><i class='fas fa-pencil-alt' style='margin-right:10px'></i>Delete Comment</button></div></div>";
      }
    }
    temp_feed += "<div class='horiz_line'></div>";
    comments_feed.innerHTML += temp_feed;
    document.getElementById("c_text_"+id).innerText = text;
    var feeds_frame = window.parent.document.getElementById('feeds_frame');
    feeds_frame.style.height = (document.documentElement.scrollHeight).toString() + 'px';
  }


  function approve(aid){
    $.post('/approve_article', {'aid':aid}).done(function(re){
      if (re[0] == true){
        parent.location.reload();
      } else {
        alert('The request was unsuccesfull, please, try again later.');
      }
    });
  }

  function edit(id,comment_authorID){
    var modal_body = document.getElementById('modal_body');
    modal_body.innerHTML = '';
    if (id == AID){
        $.post('/get_article',{'articleID':AID}).done(function(article){
          var temp = '';
          temp += "<div class=row><div class='col'>"
          temp += "<h4 style='text-align:left'>Update main picture</h4>";
          temp += "<input style='border:none;padding-bottom:10px;margin:0;' type='file' href='#' id='update_picture_button' accept='image/png, image/jpeg'/></div><div class='col'>";
          temp += "<div style='padding-top:20px;' class='btn-group btn-group-toggle' data-toggle='buttons'><label class='btn btn-secondary active'>";
          temp += "<input type='radio' name='options' id='option1' autocomplete='off' checked onclick='set_orientation(\"portrait\")'> Portrait</label>";
          temp += "<label class='btn btn-secondary'>";
          temp += "<input type='radio' name='options' id='option1' autocomplete='off' onclick='set_orientation(\"landscape\")'> Landscape</label></div></div></div>";
          temp += "<div class='article_text'><textarea id='NewArticle' rows='15' style='min-height:400px;max-height:100%'>"+article['md_text']+"</textarea></div>";
          temp += "<div class='didascalic centered'><p class='nomargin'>Additional Resources (Optional)<br><span style='color:red;font-weight:bold'>Warning: new uploads will overwrite previous ones.</span><br><strong>Do not upload competition resources here</strong><br>(max. 20Mb)</p><div class='row align-items-center'><div class='col'></div><div class='didascalic upload_form col-md-4'>";
          temp += "<input id='upload_additional_resources' type='file' name='' value='' multiple><ul id='files_list'></ul></div><div class='col'></div></div></div>";
          modal_body.innerHTML = temp;
          $("#NewArticle").markdownEditor();
          var preview = document.getElementsByClassName('md-preview')[0];
          preview.setAttribute('style','min-height:200px;max-height:100%;text-align:justify;');
          var save_btn = document.getElementById('save_changes_btn');
          save_btn.setAttribute('onclick',"save_edits('"+id+"')");
          parent.window.scrollTo({ top: 0, behavior: 'smooth' });
          $('#submit_results_modal').modal();
        });
    } else {
      var c_text = document.getElementById('c_text_'+id);
      var temp = '';
      temp += "<h3>Edit Comment</h3>"
      temp += "<div class=row><div class='col'>";
      temp += "<textarea id='edited_comment' rows='15' style='width:90%;height:200px' value=''>"+c_text.innerHTML+"</textarea></div>";
      modal_body.innerHTML = temp;
      var save_btn = document.getElementById('save_changes_btn');
      if (comment_authorID){
        save_btn.setAttribute('onclick',"save_edits(\""+id+"\",\""+comment_authorID+"\")");
      } else {
        save_btn.setAttribute('onclick',"save_edits('"+id+"')");
      }
      parent.window.scrollTo({ top: 0, behavior: 'smooth' });
      $('#submit_results_modal').modal();
    }
  }


  var img_orientation = 'portrait';
  function set_orientation(orientation){
    img_orientation = orientation;
  }


  function save_edits(id,comment_authorID){
    if (id==AID){
      let article = document.getElementById('NewArticle');
      // let edited_articleID = generate_articleID();
      let img = $('#update_picture_button').prop('files')[0];
      let resources = $('#upload_additional_resources').prop('files');
      var form = new FormData();
      if (img){
        if (img['size'] <= 5000000 && (img['type'] == 'image/jpg' || img['type'] == 'image/jpeg' || img['type'] == 'image/png')){
          form.append('picture',img);
          form.append('orientation',img_orientation);
        } else {
          alert("Main image max size 5Mb. Accepted files: .jpeg, .jpg, .png")
          return
        }
      }
      if (resources['length']>0){
        var total_size = 0;
        for (var i=0; i<resources['length'];i++){
          total_size += resources[i]['size'];
        }
        if (total_size <= 20000000){
          form.append('n_resources',resources['length']);
          for (var i=0; i<resources['length']; i++){
            form.append('file_'+i,resources[i]);
          }
        } else {
          alert('Uploaded resources exceeds the maximum files size of 20Mb.')
          return
        }
      }
      form.append('aid',AID);
      form.append('uid',UID);
      form.append('article',article.value);
      $.ajax({
        url:"/edit_article",
        data:form,
        type:"POST",
        contentType:false,
        processData:false,
      }).done(function(re){
        if (re[0]==true){
          $('#submit_results_modal').modal('hide');
          alert('Your edit has been saved and will be reviewed by our moderators before being published. You can always submit a new review if you missed something.');
          parent.location.reload();
        } else {
          alert("Something went wrong. Please try again later :(");
        }
      }).fail(function(xhr, status, error) {
        alert("Error: "+error+" - "+status);
      });
    } else {
      var edited_comment = document.getElementById('edited_comment').value;
      if (!comment_authorID) {
        comment_authorID = UID;
      }
      $.post("/save_edits",{'aid':AID,'id':id,'editor':UID, 'text':edited_comment, 'author':comment_authorID}).done(function(re){
        $('#submit_results_modal').modal('hide');
        location.reload();
      });
    }
  }

  function generate_articleID(){
    return Date.now().toString() + Date.now().toString(36).substr(Math.random()*(8-2)+2,9) + Math.random().toString(36).substr(2,9);
  }

  function delete_element(id,authorID=UID){
    var confirm_delete = confirm('Warning: This operation is irreversible. Do you wish to proceed anyway?');
    if (confirm_delete == true) {
      $.post('/delete',{'uid':authorID,'aid':AID,'id':id}).done(function(re){
        if (re['response'] == 'comment_deleted'){
          location.reload();
        } else if (re['response'] == 'article_deleted') {
          parent.load_feed('dashboard');
        } else if (re['response'] == 'competition_failed') {
          alert('This competition has already a submission. To delete your competition, contact admin at XXXresearchcommunity@ucc.ie');
        }
      });
    }
  }


  function vote(id,up_down){
    if (checkLogin()){
      $.post('/vote',{'uid':UID,'aid':AID,'id':id,'up_down':up_down}).done(function(re){
        if (re[0] == true){
          var vote = parseInt(document.getElementById('votes_'+id).innerHTML);
          if (up_down == 'up'){
            vote += 1;
          } else if (up_down == 'down') {
            vote -= 1;
          }
          document.getElementById('votes_'+id).innerHTML = vote.toString();
        } else if (re[0] == false) {
          alert('Sorry, you can only vote once or the comment has been removed.');
        }
      });
    } else {
      alert("You must be a logged user to vote.")
    }
  }

  function scroll_page(id_element){
    var offset = document.getElementById(id_element).offsetTop;
    parent.window.scrollTo({ top: offset, behavior: 'smooth' });
  }

  function checkLogin(){
    if (UID && USER_DATA && UID != false && USER_DATA != false) {
      return true
    } else {
      return false
    }
  }
