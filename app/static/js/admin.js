var create_article_btn = window.parent.document.getElementById('create_article_btn');
create_article_btn.style.display = 'none';
var user_articles_toggle = window.parent.document.getElementById('user_articles_toggle');
user_articles_toggle.style.display='inline-block';

var show_articles_btn = window.parent.document.getElementById('show_articles_btn');
var show_users_btn = window.parent.document.getElementById('show_users_btn');
show_articles_btn.setAttribute('onclick', "document.getElementById('feeds_frame').contentWindow.show_articles()");
show_users_btn.setAttribute('onclick', "document.getElementById('feeds_frame').contentWindow.show_users()");

var div_messages = parent.document.getElementById('bad_request_message');
div_messages.innerHTML = "";

// var articles_feed = document.getElementById('articles_feed');
// var users_feed = document.getElementById('users_feed');
// articles_feed.innerHTML = '';
// users_feed.innerHTML= '';

if (show_articles_btn.checked == true) {
  show_articles();
} else if (show_users_btn.checked == true) {
  show_users();
}

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
const UID = loadUID();

function get_all_users(){
  var loading_bar = window.parent.document.getElementById('loading_bar');
  loading_bar.setAttribute('aria-valuenow',25);
  loading_bar.style.width = '25%';
  $.post('/get_all_users').done(function(users){
    loading_bar.setAttribute('aria-valuenow',50);
    loading_bar.style.width = '50%';
    var feed = document.getElementById('users_feed');
    feed.innerHTML = "<div class='row centered'><div class='col'><h2>Users</h2></div></div>";
    feed.innerHTML += "<div class='row admin_cell'><div class='col-md-1'></div><div class='col'><p style='font-weight:bold'>Private Email</p></div><div class='col'><p style='font-weight:bold'>Full Name</p></div><div class='col-md-2'><p style='font-weight:bold'>Badge</p></div><div class='col-md-2'><p style='font-weight:bold'>Phone</p></div><div class='col-md-1'><p style='font-weight:bold'>Last Visit</p></div></div>";
    for (var i=0; i<users.length; i++){
      var user = users[i];
      var temp_feed = "<div class='row admin_cell' onclick=load_profile('"+encodeURI(JSON.stringify(user)).replace("'","\\'")+"')><div class='col-md-1'>";
      if (user['profile']['img']){
        temp_feed += "<img src="+user['profile']['img']+" alt='profile_pic' style='height:50px;width:50px;border-radius: 100%;clip-path: circle(50px at center);'></div><div class='col'>";
      } else {
        temp_feed += "<img src='../static/imgs/noAvatar.png' alt='profile_pic' style='height:50px;width:50px;border-radius: 100%;clip-path: circle(50px at center);'></div><div class='col'>";
      }
      temp_feed += "<p>"+user['profile']['email']+"</p></div><div class='col'>";
      temp_feed += "<p>"+user['profile']['name']+" "+user['profile']['surname']+"</p></div><div class='col-md-2'>";
      if (user['profile']['badge'] == 'Banned User'){
        temp_feed += "<p style:'color:red'>"+user['profile']['badge']+"</p></div><div class='col-md-2'>";
      } else {
        temp_feed += "<p>"+user['profile']['badge']+"</p></div><div class='col-md-2'>";
      }
      if (user['profile']['phone']){
        var phone = user['profile']['phone'].replace(/\s+/g, '');
        temp_feed += "<p>"+phone+"</p></div>";
      } else {
        temp_feed += "<p>no phone</p></div>";
      }
      temp_feed += "<div class='col-md-1'>";
      var last_visit = user['last_visits'][user['last_visits'].length -1];
      last_visit = chunk(last_visit,2).join('/');
      temp_feed += "<p>"+last_visit+"</p></div></div>";
      feed.innerHTML += temp_feed;
    }
    resize_iframe();
    loading_bar.setAttribute('aria-valuenow',100);
    loading_bar.style.width = '100%';
  });
}

function chunk(str, n) {
  var ret = [];
  var i;
  var len;
  for(i = 0, len = str.length; i < len; i += n) {
     ret.push(str.substr(i, n))
  }
  return ret
};

function get_all_articles(){
  var loading_bar = window.parent.document.getElementById('loading_bar');
  loading_bar.setAttribute('aria-valuenow',25);
  loading_bar.style.width = '25%';
  $.post("/get_all_articles",{'pending':true}).done(function(articles){
    loading_bar.setAttribute('aria-valuenow',50);
    loading_bar.style.width = '50%';
    var feed = document.getElementById('articles_feed');
    feed.innerHTML = "<div class='row centered'><div class='col'><h2>Articles</h2></div></div>";
    for (var i=0; i<articles.length; i++){
      var id = articles[i]['articleID'];
      var readable_id = 'art_'+id;
      var article = articles[i]
      let date = article['date'];
      let title = article['title'];
      var date_number = parseInt(date.replace('/',''));
      var temp_feed = "<div class='row admin_cell' onclick=read_article('"+readable_id+"')><div class='col-md-1'>";
      if (article['edit']){
        let date_edit = article['edit']['date'];
        date_number = parseInt(date_edit.replace('/',''));
      }
      if (date_number >= parseInt(USER_DATA['last_visits'][0])){
        temp_feed += "<i class='fas fa-circle' id='notification'></i>";
      } else {
        temp_feed += "<i class='far fa-circle' id='notification'></i>";
      }
      temp_feed += "</div><div class='col'><h3 class='card-title'>"+title+"</h3></div><div class='col-md-2'>";
      if (article['competition']){
        if (article['competition_closed']){
          temp_feed += "<i class='fas fa-handshake-slash fa-lg'></i>";
        } else {
          temp_feed += "<i class='fas fa-handshake fa-lg'></i>";
        }
      } else {
        temp_feed += "<i class='fas fa-handshake fa-lg' style='color: #c8c1c1'></i>";
      }
      if (article['pending']){
        temp_feed += "<i class='fas fa-hourglass-half fa-lg'></i>";
      } else {
        temp_feed += "<i class='fas fa-hourglass-half fa-lg' style='color: #c8c1c1'></i>";
      }
      if (article['edit']){
        let date_edit = article['edit']['date'];
        temp_feed += "</div><div class='col-md-2'><table><tr><td><h4>Edited: </h4></td><td><h4>"+date_edit+"</h4></td></tr></table></div></div>";
      } else {
        temp_feed += "</div><div class='col-md-2'><table><tr><td><h4>Created: </h4></td><td><h4>"+date+"</h4></td></tr></table></div></div>";
      }
      feed.innerHTML += temp_feed;
    }
    resize_iframe();
    loading_bar.setAttribute('aria-valuenow',100);
    loading_bar.style.width = '100%';
  });
}

function show_articles(){
  var articles_feed = document.getElementById('articles_feed');
  var users_feed = document.getElementById('users_feed');
  articles_feed.style.display = 'block';
  users_feed.style.display = 'none';
  if (articles_feed.innerHTML == ''){
    get_all_articles();
  }
}

function show_users(){
  var articles_feed = document.getElementById('articles_feed');
  var users_feed = document.getElementById('users_feed');
  articles_feed.style.display = 'none';
  users_feed.style.display = 'block';
  if (users_feed.innerHTML == ''){
    get_all_users();
  }
}



function read_article(id){
  id = id.substring(4,);
  id = JSON.stringify(id);
  localStorage.setItem('articleID',id);
  parent.load_feed('read_article');
}


function load_profile(user_data){
  user_data = decodeURI(user_data);
  cached_user = user_data;
  user_data = JSON.parse(user_data);
  cached_user = btoa(cached_user);
  cached_uid = JSON.stringify(user_data['userID']);
  cached_uid = btoa(cached_uid);
  localStorage.setItem('_otherID',cached_uid);
  localStorage.setItem('_other_user_data',cached_user);
  parent.load_feed('profile_view');
}

function resize_iframe(){
  var feeds_frame = window.parent.document.getElementById('feeds_frame');
  feeds_frame.style.height = (document.documentElement.scrollHeight).toString() + 'px';
}
