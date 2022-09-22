$(".alert").hide();

var div_messages = parent.document.getElementById('bad_request_message');
div_messages.innerHTML = "";

function loadUID(){
  var uid = localStorage.getItem('_uid');
  if (!uid) return false;
  uid = atob(uid);
  uid = JSON.parse(uid);
  return uid
}
const UID = loadUID();

  $(document).ready(function(){
    $("#NewArticle").markdownEditor();
  });

  $(document).ready(function(){
    $("#make_comp_button").click(function(){
      parent.window.scrollTo({ top: 0, behavior: 'smooth' });
      $("#make_comp_modal").modal();
    });
  });

  var img_orientation = '';
  var articleID = '';
  function generate_articleID(){
    return Date.now().toString() + Date.now().toString(36).substr(Math.random()*(8-2)+2,9) + Math.random().toString(36).substr(2,9);
  }
  articleID += generate_articleID();

  function upload_img(orientation){
    img_orientation = orientation;
    document.getElementById('upload_article_img_form').click();
  }

  function upload_comp_data(data_type){
    document.getElementById(data_type).click();
  }

  $('input[id=upload_article_img_form]').change(function(ev){
    if (img_orientation == 'portrait'){
      document.getElementById('check_portrait').style.display = 'block';
    } else if (img_orientation == 'landscape') {
      document.getElementById('check_landscape').style.display = 'block';
    }
    document.getElementById('remove_img_btn').style.display = 'block';
  });

  $('input[id=input_training_data]').change(function(ev){
    check_comp_file_type('training_data');
  });
  $('input[id=input_validation_data]').change(function(ev){
    check_comp_file_type('validation_data');
  });
  $('input[id=input_description_data]').change(function(ev){
    check_comp_file_type('description_data');
  });
  $('input[id=input_other_data]').change(function(ev){
    check_comp_file_type('other_data');
  });

  function check_comp_file_type(inputForm){
    let file = $('#input_'+inputForm).prop('files')[0];
    let accepted_csv_formats = ['application/vnd.ms-excel','text/plain','text/csv','text/tsv'];
    if (inputForm == 'training_data' || inputForm == 'validation_data'){
      if (file['size']<=20000000 && accepted_csv_formats.includes(file['type'])){
        populate_uploaded_text(inputForm);
      } else {
        confirm('The file must be a ".csv" only. The max upload size is 20Mb per file.')
        remove_upFile(inputForm);
      }
    } else {
      var accepted_formats = ['application/vnd.ms-excel','text/plain','text/csv','text/tsv', 'application/zip','application/pdf'];
      if (file['size']<=20000000 && accepted_formats.includes(file['type'])){
        populate_uploaded_text(inputForm);
      } else {
        confirm('The file must be a CSV, TEXT, PDF or ZIP only. The max upload size is 20Mb per file.')
        remove_upFile(inputForm);
      }
    }
  }

  function populate_uploaded_text(inputForm){
    var form = document.getElementById('input_'+inputForm);
    let file = $('#input_'+inputForm).prop('files')[0];
    var uploaded = document.getElementById('uploaded_'+inputForm);
    uploaded.innerHTML = '<a style="float:left;" href="#" onclick="remove_upFile(\''+inputForm+'\')"><i class="fas fa-window-close fa-lg secondnav_button"></i></a><p style="max-width:70px;overflow:hidden;">'+inputForm+'</p>';
    uploaded.style.display = 'inline-block';
  }

  function remove_upFile(inputForm){
    var form = document.getElementById('input_'+inputForm);
    var uploaded = document.getElementById('uploaded_'+inputForm);
    form.value='';
    uploaded.innerHTML = '';
  }



  function publish_article(){
    let article = document.getElementById('NewArticle');

    if (article.value && article.value.length > 100){
      let files = $('#upload_additional_resources').prop('files');
      if (files['length']>0){
        var total_size = 0;
        for (var i=0; i<files['length'];i++){
          total_size += files[i]['size'];
          if (files[i]['type'] != 'application/zip' || files[i]['type'] != 'application/pdf'){
            alert("Only file allowed are .zip and .pdf");
            return false;
          }
        }
        if (total_size <= 20000000){
          for (var i=0; i<files['length'];i++){
            var form = new FormData();
            form.append('file',files[i]);
            form.append('articleID',articleID);
            $.ajax({
              url:"/add_article_resource",
              data: form,
              type:'POST',
              contentType : false,
              processData : false,
            });
          }
        } else {
          alert.innerHTML = "<li style='float:none;'>Max Upload size 20Mb</li>";
          $("alert").show();
        }
      }

      let picture = $('#upload_article_img_form').prop('files')[0];
      if (picture){
        if (picture['size'] <= 5000000){
          if (picture['type'] == 'image/jpeg' || picture['type'] == 'image/png' || picture['type'] == 'image/jpg') {
            var form = new FormData();
            form.append('picture',picture);
            form.append('articleID',articleID);
            form.append('orientation',img_orientation);
            //TODO: handle the done on ajax post to show namefile with cancel button
            $.ajax({
              url:"/upload_article_img",
              data: form,
              type:'POST',
              contentType : false,
              processData : false,
            });
          } else {
            alert.innerHTML = "<li style='float:none;'>Only extensions allowed: .jpg, .jpeg or .png</li>";
            $("alert").show();
          }
        } else {
          alert.innerHTML = "<li style='float:none;'>Max Upload size 5Mb</li>";
          $("alert").show();
        }
      }

      $.post("/publish_article", {'article':article.value,'articleID':articleID,'uid':UID}).done(function(re){
        if (re){
          var comp_btn = document.getElementById('remove_comp_button');
          if (comp_btn){
            make_competition(articleID);
          } else {
            alert('Your article has been uploaded and is pending review from our moderators. You can review your pending articles from your profile page.');
            parent.location.reload();
          }
        }
      });

    } else {
      alert.innerHTML = "<li style='float:none;'>The article must contain at least 100 chatacters</li>";
      $("alert").show();
    }
  }



  function make_competition(articleID){
    var weighted_evas = {}
    for (var i=0; i < evaluation_measures.length; i++) {
      var eva_txt = document.getElementById(evaluation_measures[i]+'_txt');
      if (eva_txt.disabled == false){
        var eva_weight = Math.round(parseFloat(eva_txt.value) * 10);
        if (eva_weight > 0) {
          if (eva_weight > 10){
            eva_weight = 10;
          }
          weighted_evas[evaluation_measures[i]] = eva_weight;
        }
      }
    }
    if (Object.keys(weighted_evas).length > 0){
      let training_data = $('#input_training_data').prop('files')[0];
      let validation_data = $('#input_validation_data').prop('files')[0];
      let description_data = $('#input_description_data').prop('files')[0];
      let other_data = $('#input_other_data').prop('files')[0];
      if (training_data && validation_data){
        var total_size = training_data['size'] + validation_data['size'];
        var form = new FormData();
        form.append('training_data',training_data);
        form.append('validation_data',validation_data);
        if (description_data){
          total_size += description_data['size'];
          form.append('description_data',description_data);
        }
        if (other_data) {
          total_size += other_data['size'];
          form.append('other_data',other_data);
        }
        if (total_size <= 50000000){
          form.append('weighted_evas',JSON.stringify(weighted_evas));
          form.append('competition_type',competition_type);
          form.append('articleID',articleID);
          $.ajax({
            url:'/add_comp_resources',
            data: form,
            type: 'POST',
            contentType: false,
            processData : false,
          }).done(function(re){
            if (re[0] == false){
              alert('Something went wrong. Please check the following possible causes:\n\n\u2022 Your validation or training data contains null values in the class feature;\n\u2022 The class feature have different data-type in the Validation and Trainig dataset;');
              $.post('/delete',{'uid':UID,'aid':articleID,'id':articleID}).done(function(re){
                if (re['response'] == 'article_deleted') {
                  parent.load_feed('dashboard');
                } else {
                  parent.location.reload();
                }
              });
            } else {
              alert('Your article has been uploaded and is pending review from our moderators. You can review your pending articles from your profile page.');
              parent.location.reload();
            }
          });
        } else {
          alert('Max upload size is 50Mb');
        }
      } else {
        alert('Please, you must upload a TRAINING and a VALIDATION datasets');
      }
    } else {
      alert('Please select at least 1 evaluation measure with a weight greater than 0. Evaluation measures weighted over the max limit of 1 will be considered as 1.');
    }
  }


  $('input[id=upload_additional_resources]').change(function(ev){
    let files = $('#upload_additional_resources').prop('files');
    var list = document.getElementById('files_list');
    for (var i=0; i<files['length'];i++){
      list.innerHTML += "<li style='float:none'><span style='color:green'><i style='float:left; margin-right:10px;margin-top:3px;' class='fas fa-check-circle'></i><p style='color:black;text-align:left'>"+files[i]['name']+"</p></span></li>"
    }
    list.innerHTML += "<button onclick='remove_resources()' style='float:right;color:red;bottom:5px;right:5px;position:absolute;border-radius:10px'><i class='fas fa-window-close' style='margin-right:10px;margin-top:3px;'></i>Remove Uploads</button>"
  });

  function remove_resources() {
    document.getElementById('upload_additional_resources').value = "";
    document.getElementById('files_list').innerHTML = "";
  }

  function remove_img() {
    document.getElementById('upload_article_img_form').value = "";
    document.getElementById('check_portrait').style.display = 'none';
    document.getElementById('check_landscape').style.display = 'none';
    document.getElementById('remove_img_btn').style.display = 'none';
  }


  function goto_dashboard(){
    var discard = confirm('Do you want the discard the changes and go back to Dashboard?');
    if (discard == true){
      remove_comp_resources();
      window.parent.load_feed('dashboard');
    }
  }

  function saveAnd_goto_dashboard(){
    var save = confirm('Do you want to Publish your Article?');
    if (save == true){
      publish_article();
    }
  }

  function saveCompetition(){
    var save = confirm('Do you want to Save this Competition?');
    if (save==true){
      let training_data = $('#input_training_data').prop('files')[0];
      let validation_data = $('#input_validation_data').prop('files')[0];
      if (training_data && validation_data){
        var weighted_evas = {}
        for (var i=0; i < evaluation_measures.length; i++) {
          var eva_txt = document.getElementById(evaluation_measures[i]+'_txt');
          if (eva_txt.disabled == false){
            var eva_weight = Math.round(parseFloat(eva_txt.value) * 10);
            if (eva_weight > 0) {
              if (eva_weight > 10){
                eva_weight = 10;
              }
              weighted_evas[evaluation_measures[i]] = eva_weight;
            }
          }
        }
        if (Object.keys(weighted_evas).length > 0){
          enable_competition_btn();
          $("#make_comp_modal").modal("hide");
        } else {
          alert('Please select at least 1 evaluation measure with a weight greater than 0. Evaluation measures weighted over the max limit of 1 will be considered as 1.');
        }
      } else {
        alert('Please, you must upload a TRAINING and a VALIDATION datasets');
      }
    }
  }
  function enable_competition_btn(){
    var comp_btn = document.getElementById('comp_btn_div');
    comp_btn.innerHTML ="<a href='#' onclick='remove_comp_resources()' id='remove_comp_button' style='color:red'>Remove Competition</a>";
  }
  function remove_comp_resources(){
    var comp_btn = document.getElementById('comp_btn_div');
    comp_btn.innerHTML = "<a href='#' id='make_comp_button'>Make Competition</a>"
    document.getElementById('input_training_data').value = '';
    document.getElementById('input_validation_data').value = '';
    document.getElementById('input_description_data').value = '';
    document.getElementById('input_other_data').value = '';
  }

  function discard_competition(){
    var discard = confirm('Do you want to discard your competition changes and go back to the article?');
    if (discard == true) {
      $("#make_comp_modal").modal("hide");
    }
  }


  function show_measures(type){
    competition_type = type;
    var evauluation_measures = [];
    if (type == 'classification'){
      evaluation_measures = ['Accuracy','Precision','Recall','F1-Measure','AUC','MCC'];
    } else if (type == 'regression') {
      evaluation_measures = ['MAE','MSE','RMSE','R2'];
    }
    var eva = document.getElementById('eva_measures');
    eva.innerHTML = '';
    for (var i=0; i < evaluation_measures.length; i++) {
      var m = evaluation_measures[i];
      eva.innerHTML += "<div class='row align-items-center'><div class='col'></div><div class='col-md-4'><p style='margin:0'>"+m+"</p></div><div class='col-md-1'><input type='checkbox' id='"+m+"_chk'></div><div class='col-md-3'><input id='"+m+"_txt' type='text' placeholder='0.1 to 1' disabled></div><div class='col'></div></div>";
    }

    $('input[id=MAE_chk]').change(function(ev){
      var checkbox = document.getElementById('MAE_chk');
      var text = document.getElementById('MAE_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=MSE_chk]').change(function(ev){
      var checkbox = document.getElementById('MSE_chk');
      var text = document.getElementById('MSE_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=RMSE_chk]').change(function(ev){
      var checkbox = document.getElementById('RMSE_chk');
      var text = document.getElementById('RMSE_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=R2_chk]').change(function(ev){
      var checkbox = document.getElementById('R2_chk');
      var text = document.getElementById('R2_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });


    $('input[id=Accuracy_chk]').change(function(ev){
      var checkbox = document.getElementById('Accuracy_chk');
      var text = document.getElementById('Accuracy_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=Precision_chk]').change(function(ev){
      var checkbox = document.getElementById('Precision_chk');
      var text = document.getElementById('Precision_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=Recall_chk]').change(function(ev){
      var checkbox = document.getElementById('Recall_chk');
      var text = document.getElementById('Recall_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=F1-Measure_chk]').change(function(ev){
      var checkbox = document.getElementById('F1-Measure_chk');
      var text = document.getElementById('F1-Measure_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=AUC_chk]').change(function(ev){
      var checkbox = document.getElementById('AUC_chk');
      var text = document.getElementById('AUC_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
    $('input[id=MCC_chk]').change(function(ev){
      var checkbox = document.getElementById('MCC_chk');
      var text = document.getElementById('MCC_txt');
      if (checkbox.checked == true){
        text.disabled = false;
      } else {
        text.disabled = true;
      }
    });
  }
  var competition_type = 'classification';
  show_measures(competition_type);

  var feeds_frame = window.parent.document.getElementById('feeds_frame');
  feeds_frame.style.height = (document.documentElement.scrollHeight + 200).toString() + 'px';
