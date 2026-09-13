var user_articles_toggle = window.parent.document.getElementById('user_articles_toggle');
user_articles_toggle.style.display='none';


function loadUID(){
  var uid = localStorage.getItem('_uid');
  if (!uid) return false;
  uid = atob(uid);
  uid = JSON.parse(uid);
  return uid;
}
var UID = loadUID();
if (UID != false){
  var create_article_btn = window.parent.document.getElementById('create_article_btn');
  create_article_btn.style.display = 'block';
}

function get_all_articles(){
  var loading_bar = window.parent.document.getElementById('loading_bar');
  loading_bar.setAttribute('aria-valuenow',25);
  loading_bar.style.width = '25%';
  $.post("/get_all_articles").done(function(articles){
    loading_bar.setAttribute('aria-valuenow',50);
    loading_bar.style.width = '50%';
    var feed = document.getElementById('articles_feed');
    for (var i=0; i<articles.length; i++){
      var id = articles[i]['articleID'];
      var readable_id = 'art_'+id;
      var article = articles[i]
      var temp_feed = '';
      let timestamp = article['timestamp'];
      let date = article['date'];
      let time = article['time'].substring(0,5);
      let title = article['title'];
      let text = article['text'];
      let authorFullName = article['author'];
      let authorImg = article['authorImg'];
      let pending = article['pending'];
      let competition = article['competition'];
      let competition_closed = article['competition_closed'];
      temp_feed += "<div class='col-md-4 pull-md-right zoom'> \
        <div class='card dashcard'> \
          <div class='card-body' onclick=read_article('"+readable_id+"')>";
      if (article['competition'] == true){
        if (competition_closed == true){
          temp_feed += "<div class='container' style='background-color:orange;border:1px solid black;border-radius:20px;'>Competition Closed</div>";
        } else {
          temp_feed += "<div class='container' style='background-color:gold;border:1px solid black;border-radius:20px;'>Competition</div>";
        }
      }
      temp_feed += "<h5 class='card-title'>"+title+"</h5>";
      if(article['img']){
        let img = article['img']['url'];
        let orientation = article['img']['orientation'];
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
      temp_feed += "<div style='position:absolute;bottom:0;right:10px;'>";
      if (article['edit']){
        temp_feed += "<p>Edited: "+article['edit']['date']+"</p>";
      } else {
        temp_feed += "<p>Published: "+date+"</p>";
      }
      temp_feed += "</div></div></div></div></div>";
      feed.innerHTML += temp_feed;
    }
    var feeds_frame = window.parent.document.getElementById('feeds_frame');
    feeds_frame.style.height = (document.documentElement.scrollHeight).toString() + 'px';
    loading_bar.setAttribute('aria-valuenow',100);
    loading_bar.style.width = '100%';
    $('.preloader-wrapper', parent.document).fadeOut();
    $('body', parent.document).removeClass('preloader-site');
  });
}



function read_article(id){
  id = id.substring(4,);
  id = JSON.stringify(id);
  localStorage.setItem('articleID',id);
  parent.load_feed('read_article');
}

$(document).ready(function(){
  get_all_articles();
});
