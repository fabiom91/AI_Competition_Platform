$(".alert").hide();

var div_messages = parent.document.getElementById('bad_request_message');
div_messages.innerHTML = "";

function loadUID(){
  var uid = localStorage.getItem('_uid');
  if (!uid) return false;
  uid = atob(uid);
  uid = JSON.parse(uid);
  return uid;
}
var UID = loadUID();

function loadUSER_DATA(){
  var user_data = localStorage.getItem('_user_data');
  if (!user_data) return false;
  user_data = atob(user_data);
  user_data = JSON.parse(user_data);
  return user_data;
}
var USER_DATA = loadUSER_DATA();
if (USER_DATA && USER_DATA != false){
  if (USER_DATA['profile']['badge'] == 'Admin' || USER_DATA['profile']['badge'] == 'Moderator'){
    var admin_priviledges = document.getElementById('admin_profile_btns');
    admin_priviledges.innerHTML = "<button id='ban_btn' class='admin_button' type='submit' name='button' style='color:red'><i class='fas fa-user-slash' style='margin-right:10px'></i>Ban User</button><button id='unban_btn' class='admin_button' type='submit' name='button' style='color:orange'><i class='fas fa-user' style='margin-right:10px'></i>Remove Ban</button><button id='make_moderator_btn' class='admin_button' type='submit' name='button' style='color:green'><i class='fas fa-user-secret' style='margin-right:10px'></i>Make Moderator</button>";
  }
}


var otherID = '';
function check_other_ID(){
  var id = localStorage.getItem('_otherID');
  if (id){
    otherID = UID;
    UID = atob(id);
    UID = JSON.parse(UID);
    localStorage.removeItem('_otherID');
    if (otherID != UID){
      document.getElementById('update_profile_btn').disabled = true;
    }
  } else {
    otherID = UID;
  }
  var other_user_data = localStorage.getItem('_other_user_data');
  if (other_user_data){
    USER_DATA = atob(other_user_data);
    USER_DATA = JSON.parse(USER_DATA);
    localStorage.removeItem('_other_user_data');
  }
}
check_other_ID();
get_user_data();


$(document).ready(function(){
  hide_preloader();
  $("#make_moderator_btn").click(function(){
    $.post('/make_moderator',{'uid':UID}).done(function(re){
      if (re[0] == true){
        reload_current_profile('Moderator');
      } else {
        alert('Sorry, something went wrong, try again later. :(');
      }
    });
  });
  $("#ban_btn").click(function(){
    $.post('/ban_user',{'uid':UID}).done(function(re){
      if (re[0] == true){
        reload_current_profile('Banned User');
      } else {
        alert('Sorry, something went wrong, try again later. :(');
      }
    });
  });
  $("#unban_btn").click(function(){
    $.post('/unban_user',{'uid':UID}).done(function(re){
      if (re[0] == true){
        reload_current_profile();
      } else {
        alert('Sorry, something went wrong, try again later. :(');
      }
    });
  });
});

function reload_current_profile(badge){
  cached_uid = JSON.stringify(UID);
  cached_uid = btoa(cached_uid);
  localStorage.setItem('_otherID',cached_uid);
  if (badge){
    USER_DATA['profile']['badge'] = badge;
    cached_user = JSON.stringify(USER_DATA);
    cached_user = btoa(cached_user);
    localStorage.setItem('_other_user_data',cached_user);
    parent.load_feed('profile_view');
  } else {
    $.post('/get_user',{'uid':JSON.stringify(UID)}).done(function(user_data){
      USER_DATA = user_data;
      cached_user = JSON.stringify(USER_DATA);
      cached_user = btoa(cached_user);
      localStorage.setItem('_other_user_data',cached_user);
      parent.load_feed('profile_view');
    });
  }
}


function create_profile_page(){
  if (USER_DATA){
    const MANDATORY_FIELDS = ['name','surname'];
    const PLACEHOLDERS = ['First Name', 'Last Name'];
    var missing_fields = false;
    for (var i=0; i<MANDATORY_FIELDS.length; i++){
      if (!USER_DATA['profile'][MANDATORY_FIELDS[i]] || USER_DATA['profile'][MANDATORY_FIELDS[i]] == ''){
        missing_fields = true;
        window.parent.document.getElementsByClassName('topnav')[0].style.display = 'none';
        var box_element = document.getElementById(MANDATORY_FIELDS[i]);
        box_element.innerHTML="<textarea class='area red_area' id='"+MANDATORY_FIELDS[i]+"_field' placeholder='"+PLACEHOLDERS[i]+"'></textarea>";
        try {
          var save_button = document.getElementById('update_profile_btn');
          var cancel_button = document.getElementById('abort_update_btn');
          save_button.innerHTML = 'Save Changes';
          save_button.setAttribute('id','save_changes_btn');
          save_button.setAttribute('class','btn btn-primary');
          save_button.setAttribute('style','margin:20px 20px 5px 20px;width:100%;min-width: 200px;');
          save_button.setAttribute('onclick','save_changes()');
          cancel_button.style.display = 'none';
        } catch (e) {}
      } else {
        var box_element = document.getElementById(MANDATORY_FIELDS[i]);
        box_element.innerHTML="<h5 id='"+MANDATORY_FIELDS[i]+"_inside'>"+USER_DATA['profile'][MANDATORY_FIELDS[i]]+"</h5>";
      }
      if (missing_fields == false){
        window.parent.document.getElementsByClassName('topnav')[0].style.display = 'block';
        try {
          var save_button = document.getElementById('save_changes_btn');
          var cancel_button = document.getElementById('abort_update_btn');
          save_button.innerHTML = 'Update Profile';
          save_button.setAttribute('id','update_profile_btn');
          save_button.setAttribute('class','btn btn-secondary');
          save_button.setAttribute('style','margin:20px;width:100%;min-width: 200px;');
          save_button.setAttribute('onclick','update_profile()');
          cancel_button.style.display = 'block';
        } catch (e) {}
      }
    }
    $('.preloader-wrapper', parent.document).fadeOut();
    $('body', parent.document).removeClass('preloader-site');
  }
}
create_profile_page();


function get_user_data(){
  var loading_bar = window.parent.document.getElementById('loading_bar');
  loading_bar.setAttribute('aria-valuenow',25);
  loading_bar.style.width = '25%';
  var articles_number = document.getElementById('articles_number');
  var competitions_number = document.getElementById('competitions_number');
  var profile_fields = {
    'img' : document.getElementById('profile_picture'),
    'phrase' : document.getElementById('my_beautiful_phrase'),
    'name' : document.getElementById('name_inside'),
    'surname' : document.getElementById('surname_inside'),
    'qualifications' : document.getElementById('qualifications'),
    'badge' : document.getElementById('Badge'),
    'reputation' : document.getElementById('reputation'),
    'public_email' :  document.getElementById('email_field'),
    'phone' : document.getElementById('phone_field')
  };
  let badge_color = {
    'Novice': 'hotpink',
    'Reader': 'green',
    'Pro Reader' : 'darkgreen',
    'Inquisitor' : 'salmon',
    'Contributor' : 'mediumpurple',
    'Pro Contributor' : 'darkmagenta',
    'Publisher' : 'dodgerblue',
    'Pro Publisher' : 'royalblue',
    'Competition Owner' : 'blueviolet',
    'Advanced Publisher' : 'navy',
    'Admin': 'red',
    'Banned User' : 'red',
    'Moderator' : 'orangered'

  };
  if (USER_DATA){
    var user_profile = USER_DATA['profile'];
    var admin_priviledges = document.getElementById('admin_profile_btns');
    if (admin_priviledges.innerHTML != ''){
      if (user_profile['badge'] == 'Banned User'){
        document.getElementById('ban_btn').style.display = 'none';
        document.getElementById('unban_btn').style.display = 'block';
      }
    }
    var profile_keys = Object.keys(profile_fields);
    for (var i=0; i<profile_keys.length; i++){
      if (user_profile[profile_keys[i]]) {
        if (profile_keys[i] == 'img'){
          profile_fields['img'].setAttribute('src',user_profile['img']);
        } else {
          profile_fields[profile_keys[i]].innerHTML = user_profile[profile_keys[i]];
        }
      }
    }
    var form = new FormData();
    var articles_written_feed = document.getElementById('articles_written_feed');
    var articles_saved_feed = document.getElementById('articles_saved_feed');
    articles_saved_feed.innerHTML = '';
    var comp_dict = {};
    var comp_joined_feed = document.getElementById('competitions_joined_feed');
    comp_joined_feed.innerHTML = '';

    if (USER_DATA['articles'] || USER_DATA['competitions']){
      var artComp = [];
      if (USER_DATA['articles']){
        artComp = artComp.concat(USER_DATA['articles']);
      }
      if (USER_DATA['competitions']){
        artComp = artComp.concat(USER_DATA['competitions']);
      }
      articles_number.innerHTML = artComp.length;
      form.append('articles_written',JSON.stringify(artComp));
    }
    if (USER_DATA['competitions']) {
      competitions_number.innerHTML = USER_DATA['competitions'].length;
    }
    if (USER_DATA['saved_articles']){
      form.append('saved_articles',JSON.stringify(USER_DATA['saved_articles']));
    }
    if (USER_DATA['competition_joined']){
      form.append('uid',UID);
      form.append('competition_joined',JSON.stringify(USER_DATA['competition_joined']));
    }
    $.ajax({
      url:"/get_all_articles_lists",
      data:form,
      type:'POST',
      contentType:false,
      processData:false,
    }).done(function(re){
      var progress_status = 25;
      var increment = 0;
      if (Object.keys(re).length > 1){
        increment = Math.floor((100 - progress_status) / (Object.keys(re).length-1)) + 1;
      } else {
        increment = 100 - progress_status;
      }
      for (var j=0; j<Object.keys(re).length; j++){
        var field = Object.keys(re)[j];
        progress_status = progress_status + increment;
        loading_bar.setAttribute('aria-valuenow',progress_status);
        loading_bar.style.width = progress_status.toString() + '%';
        if (field == 'articles_written') {
          var articles_dict = {};
          for (var i=0; i<re[field].length; i++){
            var article = re[field][i];
            if (article[0] == null){
              articles_written_feed.innerHTML = '';
              var readable_id = "art_"+artComp[i];
              var temp_feed = "";
              let timestamp = article['timestamp'];
              let date = article['date'];
              let time = article['time'].substring(0,5);
              let title = article['title'];
              let text = article['text'];
              let img = article['img'];
              let orientation = article['orientation'];
              let authorFullName = article['author'];
              let authorImg = article['authorImg'];
              let pending = article['pending'];
              let competition = article['competition'];
              let competition_closed = article['competition_closed'];
              if (pending == false || otherID == UID){
                temp_feed += "<div class='col-md-2 small-card'> \
                  <div class='card dashcard'> \
                    <div class='card-body' style='overflow:hidden' onclick=read_article('"+readable_id+"')>";
                if (article['competition'] == true){
                  if (competition_closed == true){
                    temp_feed += "<div class='container' style='background-color:orange;border:1px solid black;border-radius:20px;'>Competition Closed</div>";
                  } else {
                    temp_feed += "<div class='container' style='background-color:gold;border:1px solid black;border-radius:20px;'>Competition</div>";
                  }
                }
                if (article['pending'] == true){
                  temp_feed += "<div class='container' style='background-color:greenyellow;border:1px solid black;border-radius:20px;'>Pending Approval</div>";
                }
                temp_feed += "<h5 class='card-title'>"+title+"</h5>";
                if(img != ''){
                  if (orientation == 'landscape'){
                    temp_feed += "<img class='card-img-top' src="+img+" alt='Card image cap'>";
                  } else if (orientation == 'portrait') {
                    let img_or = {0:'left',1:'right'};
                    let or = Math.floor(Math.random()*2);
                    temp_feed += "<img class='card-img-top' style='float:"+img_or[or]+";max-width:50%' src="+img+" alt='Card image cap'>";
                  }
                }
                temp_feed += "<p class='card-text'>"+text+"</p>";
                temp_feed += "<div class='container' style='position:absolute;bottom:0;right:0;left:0;background: linear-gradient(0deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 100%);padding:40px 10px 20px 10px;'>";
                temp_feed += "<ul style='padding-top:20px;display:flex;align-items:center;'><li style='text-align:center;'><img src="+authorImg+" alt='authorImg' style='height:60px;width:60px;border-radius:100%;clip-path: circle(60px at center);'></li>";
                temp_feed += "<li style='max-width:70%;text-align:center;margin:0 5%;vertical-align:center'><p class='card-author'>"+authorFullName+"</p></li></ul>";
                temp_feed += "<p style='position:absolute;bottom:0;right:10px;'>"+date+"</p></div></div></div></div>";
                temp_feed += "<div class='col'></div>";
                // articles_written_feed.innerHTML += temp_feed
                articles_dict[parseInt(timestamp)] = temp_feed;
                var keys = Object.keys(articles_dict).sort();
                for (var x=0; x<keys.length; x++){
                  articles_written_feed.innerHTML += articles_dict[keys[x]];
                }
              }
            }
          }
        }
        if (field == 'saved_articles') {
          var articles_dict = {};
          for (var i=0; i<re[field].length; i++) {
            var article = re[field][i];
            if (article[0] == null){
              var readable_id = "art_"+USER_DATA['saved_articles'][i];
              var temp_feed = "";
              let timestamp = article['timestamp'];
              let date = article['date'];
              let time = article['time'].substring(0,5);
              let title = article['title'];
              let text = article['text'];
              let img = article['img'];
              let orientation = article['orientation'];
              let authorFullName = article['author'];
              let authorImg = article['authorImg'];
              let pending = article['pending'];
              let competition = article['competition'];
              let competition_closed = article['competition_closed'];
              temp_feed += "<div class='col-md-2 small-card'> \
                <div class='card dashcard'> \
                  <div class='card-body' style='overflow:hidden' onclick=read_article('"+readable_id+"')>";
              if (article['competition'] == true){
                if (competition_closed == true){
                  temp_feed += "<div class='container' style='background-color:orange;border:1px solid black;border-radius:20px;'>Competition Closed</div>";
                } else {
                  temp_feed += "<div class='container' style='background-color:gold;border:1px solid black;border-radius:20px;'>Competition</div>";
                }
              }
              temp_feed += "<h5 class='card-title'>"+title+"</h5>";
              if(img != ''){
                if (orientation == 'landscape'){
                  temp_feed += "<img class='card-img-top' src="+img+" alt='Card image cap'>";
                } else if (orientation == 'portrait') {
                  let img_or = {0:'left',1:'right'};
                  let or = Math.floor(Math.random()*2);
                  temp_feed += "<img class='card-img-top' style='float:"+img_or[or]+";max-width:50%' src="+img+" alt='Card image cap'>";
                }
              }
              temp_feed += "<p class='card-text'>"+text+"</p>";
              temp_feed += "<div class='container' style='position:absolute;bottom:0;right:0;left:0;background: linear-gradient(0deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 100%);padding:40px 10px 20px 10px;'>";
              temp_feed += "<ul style='padding-top:20px;display:flex;align-items:center;'><li style='text-align:center;'><img src="+authorImg+" alt='authorImg' style='height:60px;width:60px;border-radius:100%;clip-path: circle(60px at center);'></li>";
              temp_feed += "<li style='max-width:70%;text-align:center;margin:0 5%;vertical-align:center'><p class='card-author'>"+authorFullName+"</p></li></ul>";
              temp_feed += "<p style='position:absolute;bottom:0;right:10px;'>"+date+"</p></div></div></div></div>";
              temp_feed += "<div class='col'></div>";
              // articles_dict[parseInt(timestamp)] = temp_feed;
              // var keys = Object.keys(articles_dict).sort();
              // for (var x=0; x<keys.length; x++){
              //   articles_saved_feed.innerHTML += articles_dict[keys[x]];
              // }
              articles_saved_feed.innerHTML += temp_feed;
            }
          }
        }
        if (field == 'submissions') {
          for (var i=0; i<re[field].length; i++){
            populate_leaderboard(re[field][i],USER_DATA['profile']);
          }
          generate_chart();
        }
      }

      var feeds_frame = window.parent.document.getElementById('feeds_frame');
      feeds_frame.style.height = (document.documentElement.scrollHeight + 400).toString() + 'px';
    });
    var badge = document.getElementById('Badge');
    badge.style.color = badge_color[badge.innerHTML];
  }
}



//radar
function generate_chart(){
  var charts = document.getElementsByClassName('chart');
  Array.prototype.forEach.call(charts, function(canvas) {
    var chartID = canvas.id;
    var last_scores = charts_dict[chartID]['last_submission']['scores'];
    var best_scores = charts_dict[chartID]['best_submission']['scores'];
    var ctxR = canvas.getContext('2d');
    var myRadarChart = new Chart(ctxR, {
      type: 'radar',
      data: {
        labels: Object.keys(last_scores),
        datasets: [
          {
            label: "Last Score",
            data: Object.values(last_scores),
            backgroundColor: ['rgba(105, 0, 132, .2)',],
            borderColor: ['rgba(200, 99, 132, .7)',],
            borderWidth: 2
          },{
            label: "Best Score",
            data: Object.values(best_scores),
            backgroundColor: ['rgba(0, 250, 220, .2)',],
            borderColor: ['rgba(0, 213, 132, .7)',],
            borderWidth: 1
          }
        ]
      },
      options: {responsive: false}
    });
  });
}

var charts_dict = {};
function populate_leaderboard(submissions,profile){
  var comp_joined_feed = document.getElementById('competitions_joined_feed');
  var article = submissions['article']
  var articleID = article['articleID'];
  var readable_id = 'art_'+articleID;
  var last_submission = {};
  var best_submission = {};
  var last_time = 0;
  for (var i=0; i<Object.keys(submissions).length-1; i++){
    var sub_time = Object.keys(submissions)[i];
    if (sub_time > last_time){
      last_time = sub_time;
    }
    var sub = submissions[sub_time];
    if (sub['leader_score']){
      best_submission = sub;
    }
  }
  last_submission = submissions[last_time];

  let medals = {
    1 : 'Gold Medal',
    2 : 'Silver Medal',
    3 : 'Bronze Medal'
  }
  var position = best_submission['leader_score']['position'];
  var total = best_submission['leader_score']['total_participants'];
  var medal = medals[position];

  let timestamp = article['timestamp'];
  let date = article['date'];
  let time = article['time'].substring(0,5);
  let title = article['title'];
  let text = article['text'];
  let img = article['img'];
  let orientation = article['orientation'];
  let authorFullName = article['author'];
  let authorImg = article['authorImg'];
  let pending = article['pending'];
  let competition = article['competition'];
  let competition_closed = article['competition_closed'];

  var temp_feed = "<div class='row centered'><div class='col-md-3 small-card'> \
    <div class='card dashcard'> \
      <div class='card-body' onclick=read_article('"+readable_id+"')>";
  if (competition_closed == true){
    temp_feed += "<div class='container' style='background-color:orange;border:1px solid black;border-radius:20px;'>Competition Closed</div>";
  } else {
    temp_feed += "<div class='container' style='background-color:gold;border:1px solid black;border-radius:20px;'>Competition</div>";
  }
  temp_feed += "<h5 class='card-title'>"+title+"</h5>";
  if(img != ''){
    if (orientation == 'landscape'){
      temp_feed += "<img class='card-img-top' src="+img+" alt='Card image cap'>";
    } else if (orientation == 'portrait') {
      let img_or = {0:'left',1:'right'};
      let or = Math.floor(Math.random()*2);
      temp_feed += "<img class='card-img-top' style='float:"+img_or[or]+";max-width:50%' src="+img+" alt='Card image cap'>";
    }
  }
  temp_feed += "<p class='card-text'>"+text+"</p>";
  temp_feed += "<div class='container' style='position:absolute;bottom:0;right:0;left:0;background: linear-gradient(0deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 60%, rgba(255,255,255,0) 100%);padding:40px 10px 20px 10px;'>";
  temp_feed += "<ul style='padding-top:20px;display:flex;align-items:center;'><li style='text-align:center;'><img src="+authorImg+" alt='authorImg' style='height:60px;width:60px;border-radius:100%;clip-path: circle(60px at center);'></li>";
  temp_feed += "<li style='max-width:70%;text-align:center;margin:0 5%;vertical-align:center'><p class='card-author'>"+authorFullName+"</p></li></ul>";
  temp_feed += "<p style='position:absolute;bottom:0;right:10px;'>"+date+"</p></div></div></div></div>";

  var delta = parseInt(total) - (parseInt(position)-1);
  if (delta == 0){
    delta += 1;
  }
  var progress = Math.round((delta / parseInt(total)) * 100);

  temp_feed += "<div class='col'><div class='row comp_progress'><div class='col' align='center'><canvas class='chart' id='"+articleID+"'></canvas></div>";
  temp_feed += "<div class='col' style='min-width:400px;'><p>"+position+" of "+total+" on the <strong>Public</strong> Leaderboard</p><h3>"+medal+"</h3>";
  temp_feed += "<div class='progress'>";
  temp_feed += "<div class='progress-bar' role='progressbar' style='width:"+progress+"%' aria-valuenow='"+progress+"' aria-valuemin='0' aria-valuemax='100'></div>";
  temp_feed += "</div></div></div></div></div></div>";

  comp_joined_feed.innerHTML += temp_feed;
  charts_dict[articleID] = {'last_submission':last_submission,'best_submission':best_submission};
}

function show_preloader(){
  var Body = $('body');
  Body.addClass('preloader-site');
  $('.preloader-wrapper', document).fadeIn();
}
function hide_preloader(){
  $('.preloader-wrapper', document).fadeOut();
  $('body', document).removeClass('preloader-site');
}


function save_changes(){
  show_preloader();
  var corrected_keys = {
    'name_field' : 'name',
    'surname_field' : 'surname',
    'phone_field' : 'phone',
    'my_phrase_field' : 'phrase',
    'public_email_field' : 'public_email',
    'qualifications_box_field' : 'qualifications'
  };
  var update_dict = {};
  var all_areas = $("textarea");
  for (var i=0; i<all_areas.length; i++){
    var key = corrected_keys[all_areas[i].id];
    var value = all_areas[i].value;
    if (key == 'phrase' || key == 'name' || key == 'surname'){
      value = value.replace(/[^a-zA-Z ]/g, "");
    }
    if (value.length > 0){
      update_dict[key] = value;
    }
  }
  var form = new FormData();
  update_dict = JSON.stringify(update_dict);
  let picture = $('#update_picture_button').prop('files')[0];
  if (picture) {
    if (picture['size'] <= 5000000){
      if (picture['type'] == 'image/jpeg' || picture['type'] == 'image/png' || picture['type'] == 'image/jpg'){
        form.append('picture',picture);
      } else {
        alert("Only extensions allowed: .jpg, .jpeg or .png");
      }
    } else {
      alert("max upload size is 5Mb");
    }
  }
  form.append('uid',UID);
  form.append('user_dict',update_dict);
  $.ajax({
    url:"/save_profile_changes",
    data: form,
    type:'POST',
    contentType : false,
    processData : false,
  }).done(function(updated_profile){
    var user = updated_profile['user'];
    if (user['invalid_fields'] && user['invalid_fields'].length > 0){
      for (var i=0; i<user['invalid_fields'].length; i++){
        alert.innerHTML += "<li style='float:none;'>"+user['invalid_fields'][i]+"</li>";
      }
      $(".alert").show();
    } else {
      delete user['invalid_fields'];
      USER_DATA = user;
      string_user_data = JSON.stringify(USER_DATA);
      cached_user = btoa(string_user_data);
      localStorage.setItem('_user_data',cached_user);
      const MANDATORY_FIELDS = ['name','surname'];
      for (var i=0; i<MANDATORY_FIELDS.length; i++){
        if (USER_DATA['profile'][MANDATORY_FIELDS[i]] == ''){
          parent.load_feed('profile_view');
          break;
        }
      }
      var navbar_profile_pic = window.parent.document.getElementById('noAvatar');
      navbar_profile_pic.innerHTML = "<img src='"+USER_DATA['profile']['img']+"' alt='noAvatar'>";
      hide_preloader();
      if (picture) {
        USER_DATA['profile']['img'] = updated_profile['picture_url'];
        var main_avatar = parent.document.getElementById('noAvatar');
        main_avatar.innerHTML = "<img src='"+USER_DATA['profile']['img']+"' alt='noAvatar'>";
        string_user_data = JSON.stringify(USER_DATA);
        cached_user = btoa(string_user_data);
        localStorage.setItem('_user_data',cached_user);
        alert('Your profile picture has been changed. Depending on how big your picture is, it could take a few minutes before it will show up in your Profile. Thank you!');
      }
      parent.load_feed('profile_view');
    }
  });

}


function read_article(id){
  id = id.substring(4,);
  id = JSON.stringify(id);
  localStorage.setItem('articleID',id);
  parent.load_feed('read_article');
}

function update_profile() {
  const boxes_ids = ['qualifications_box','public_email','phone','my_phrase'];
  const placeholders = ['Qualifications (e.g. PhD in Science... - Working at...)','Public email address','Public phone number','my motto'];
  for (var i=0; i<boxes_ids.length; i++) {
    var box_element = document.getElementById(boxes_ids[i]);
    box_element.innerHTML="<textarea class='area' id='"+boxes_ids[i]+"_field' placeholder='"+placeholders[i]+"'></textarea>";
  }
  var save_button = document.getElementById('update_profile_btn');
  cancel_button = document.getElementById('abort_update_btn');
  save_button.innerHTML = 'Save Changes';
  save_button.setAttribute('id','save_changes_btn');
  save_button.setAttribute('class','btn btn-primary');
  save_button.setAttribute('style','margin:20px 20px 5px 20px;width:100%;min-width: 200px;');
  save_button.setAttribute('onclick','return save_changes()');
  cancel_button.style.display = 'block';
  var update_picture_button = document.getElementById('update_picture_button');
  update_picture_button.style.display = 'block';
}

function reload() {
  location.reload();
}
