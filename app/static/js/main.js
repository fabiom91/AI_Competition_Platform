var user_articles_toggle = document.getElementById("user_articles_toggle");
user_articles_toggle.style.display = "none";

var provider = new firebase.auth.GoogleAuthProvider();
var ui = new firebaseui.auth.AuthUI(firebase.auth());
ui.start("#firebaseui-auth-container", {
  signInOptions: [
    // List of OAuth providers supported.
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
  // Other config options...
});

function load_search_archive() {
  $.post("/load_search_archive").done(function (re) {
    var archive = [];
    for (var i = 0; i < re.length; i++) {
      var icon = "";
      if (re[i]["KIND"] == "user") {
        if (re[i]["IMG"] && re[i]["IMG"] != "999") {
          icon =
            "<img src='" +
            re[i]["IMG"] +
            "' style='width:50px;height:50px;clip-path: circle(50px at center);border-radius: 100%;'></img>";
        } else {
          icon = "<i class='fas fa-user fa-2x'></i>";
        }
      } else if (re[i]["KIND"] == "article") {
        icon = "<i class='fas fa-file-alt fa-2x'></i>";
      }
      archive.push({
        value: re[i]["ID"],
        label: re[i]["VALUE"],
        desc: re[i]["KIND"],
        icon: icon,
      });
    }
    $(function () {
      var projects = archive;

      $("#project")
        .autocomplete({
          minLength: 0,
          source: projects,
          focus: function (event, ui) {
            $("#project").val(ui.item.label);
            return false;
          },
          select: function (event, ui) {
            $("#project").val(ui.item.label);
            $("#project-id").val(ui.item.value);
            $("#project-description").val(ui.item.desc);
            $("#project-icon").html(ui.item.icon);

            return false;
          },
        })
        .autocomplete("instance")._renderItem = function (ul, item) {
        if (item.desc == "user") {
          return $("<li>")
            .append(
              "<div class='row' style='padding:5px 0;' onclick='load_profile(\"" +
                item.value +
                "\")'><div class='col-md-2' align='center' style='color:#a569fa;'>" +
                item.icon +
                "</div><div class='col' style='vertical-align:center'>" +
                item.label +
                "</div></div>"
            )
            .appendTo(ul);
        } else if (item.desc == "article") {
          return $("<li>")
            .append(
              "<div class='row' style='padding:5px 0;' onclick='read_article(\"" +
                item.value +
                "\")'><div class='col-md-2' align='center' style='color:#a569fa;'>" +
                item.icon +
                "</div><div class='col' style='vertical-align:center'>" +
                item.label +
                "</div></div>"
            )
            .appendTo(ul);
        }
      };
    });
  });
}
load_search_archive();

$("#project").on("focusout", function (event) {
  var bar = document.getElementById("project");
  clearContents(bar);
});

function read_article(id) {
  id = JSON.stringify(id);
  localStorage.setItem("articleID", id);
  load_feed("read_article");
}

function load_profile(id) {
  $.post("/get_user", { uid: JSON.stringify(id) })
    .done(function (user_data) {
      cached_user = JSON.stringify(user_data);
      cached_user = btoa(cached_user);
      cached_uid = JSON.stringify(id);
      cached_uid = btoa(cached_uid);
      localStorage.setItem("_otherID", cached_uid);
      localStorage.setItem("_other_user_data", cached_user);
      load_feed("profile_view");
    })
    .fail(function (xhr, status, error) {
      console.log(xhr);
      console.log(status);
      console.log(error);
    });
}

function clearContents(element) {
  element.value = "";
}

function myFunction() {
  var x = document.getElementById("my_second_nav");
  if (x.className === "second_nav") {
    x.className += " responsive";
  } else {
    x.className = "second_nav";
  }
}

function load_feed(feedname) {
  // This first IF statement disable the creation of new articles/competitions
  if (feedname == "create_article") {
    alert(
      "Apologies, the function to create NEW articles or competitions have been temporarily disabled. If you wish to join an existing competition, please click on its thumbnail on the Dashboard. If you need help, contact airesearch.platform@gmail.com"
    );
  } else {
    var feed = document.getElementById("feeds_div");
    feed.innerHTML =
      "<iframe  src='" +
      feedname +
      ".html' id='feeds_frame'><p>Your browser does not support iframes.</p></iframe>";
    if (feedname == "dashboard" || feedname == "admin") {
      document.getElementById("search_bar").style.display = "block";
    } else {
      document.getElementById("search_bar").style.display = "none";
    }
    if (feedname != "admin") {
      auto_activate_button(feedname + "_button");
    }
  }
}

function auto_activate_button(button) {
  button_list = ["dashboard_button", "about_button"];
  try {
    for (var i = 0; i < button_list.length; i++) {
      var b = button_list[i];
      if (b == button) {
        document.getElementById(b).className = "active";
        document.getElementById(b + "1").className = "active";
      } else {
        document.getElementById(b).className = "";
        document.getElementById(b + "1").className = "";
      }
    }
  } catch (e) {}
}

$(document).ready(function () {
  $("#login_button").click(function () {
    document.getElementById("modal_title").innerHTML = "Welcome Back";
    document.getElementById("log_reg_description").innerHTML =
      "Use your Research Community credentials to sign in";
    // document.getElementById('social1').innerHTML = "<i class='fab fa-google' style='margin-right:15px'></i>Login via Google";
    // document.getElementById('social2').innerHTML = "<i class='fab fa-github' style='margin-right:15px'></i>Login via GitHub";
    document.getElementById("modal_footer").innerHTML =
      "<button type='button' class='btn btn-secondary' data-dismiss='modal'>Cancel</button><button type='button' class='btn btn-primary' onclick=request_auth('login')>Confirm</button>";
    document.getElementById("forgot_btn").style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#login_register_modal").modal();
  });
});

$(document).ready(function () {
  $("#register_button").click(function () {
    document.getElementById("modal_title").innerHTML = "Welcome to XXX";
    document.getElementById("log_reg_description").innerHTML =
      "Please register with your email and password to join our Neonatology and Paediatrics ML Oriented Research Community.";
    document.getElementById("log_reg_disclaimer").innerHTML =
      "<strong>Please do not use your work email address.</strong>";
    document.getElementById("log_browser_disclaimer").innerHTML =
      '<h3>Supported Browsers:</h3> <ul style="display: flex;"><li style="display:inline"><img class="browser_logo" src="../static/imgs/chrome.jpg" alt="Google Chrome"></img></li><li style="display:inline"><img class="browser_logo" src="../static/imgs/safari.png" alt="Safari"></img></li><li style="display:inline"><img class="browser_logo" src="../static/imgs/firfox.jpg" alt="Mozilla Firefox"></img></li></ul>';
    // document.getElementById('social1').innerHTML = "<i class='fab fa-google' style='margin-right:15px'></i>Register via Google";
    // document.getElementById('social2').innerHTML = "<i class='fab fa-github' style='margin-right:15px'></i>Register via GitHub";
    document.getElementById("modal_footer").innerHTML =
      "<button type='button' class='btn btn-secondary' data-dismiss='modal'>Cancel</button><button type='button' class='btn btn-primary' onclick=request_auth('registration')>Confirm</button>";
    document.getElementById("forgot_btn").style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#login_register_modal").modal();
  });
});

$(document).ready(function ($) {
  var Body = $("body");
  Body.addClass("preloader-site");
});

function recover_password() {
  var email = document.getElementById("email_textbox").value;
  if (email != "") {
    auth
      .sendPasswordResetEmail(email)
      .then(function () {
        alert("An email has been sent to: " + email);
        $("#login_register_modal").modal("hide");
      })
      .catch(function (error) {
        alert(
          "Sorry, an error has occur: " +
            error +
            " If you think your account has been deleted without your permission, please, contact us immediately at: XXXresearchcommunity@gmail.com"
        );
      });
  } else {
    alert("Please enter a valid email address and try again.");
  }
}

function loadUID() {
  var uid = localStorage.getItem("_uid");
  if (!uid) return false;
  uid = atob(uid);
  uid = JSON.parse(uid);
  return uid;
}

function request_auth(type) {
  var email = document.getElementById("email_textbox").value;
  var password = document.getElementById("password_textbox").value;
  if (type == "registration") {
    firebase
      .auth()
      .createUserWithEmailAndPassword(email, password)
      .then(function (user) {
        var id = user["user"]["uid"];
        $.post("/create_new_user", { uid: id, email: email }).done(function (
          re
        ) {
          USER_DATA = {
            profile: {
              badge: "Novice",
              email: email,
              reputation: "0",
              MFA: null,
            },
          };
          string_user_data = JSON.stringify(USER_DATA);
          cached_user = btoa(string_user_data);
          localStorage.setItem("_user_data", cached_user);
          UID = id;
          string_uid = JSON.stringify(UID);
          cached_uid = btoa(string_uid);
          localStorage.setItem("_uid", cached_uid);
          // request_auth('login')
          // $("#login_register_modal").modal("hide");
          // load_feed('profile_view');
        });
      })
      .catch(function (error) {
        var errorCode = error.code;
        var errorMessage = error.message;
        alert(
          errorCode +
            " - " +
            errorMessage +
            " If you think your account has been deleted without your permission, please, contact us immediately at: XXXresearchcommunity@gmail.com"
        );
      });
  } else if (type == "login") {
    firebase
      .auth()
      .signInWithEmailAndPassword(email, password)
      .catch(function (error) {
        var errorCode = error.code;
        var errorMessage = error.message;
        alert(errorCode + " - " + errorMessage);
      });
  }
}

function send_email_verification(email) {
  firebase
    .auth()
    .currentUser.sendEmailVerification()
    .then(() => {
      firebase.auth().signOut();
      $.get("/verify_email", { email: email });
    });
}

function generateUniqueString() {
  var ts = String(new Date().getTime()),
    i = 0,
    out = "";

  for (i = 0; i < ts.length; i += 2) {
    out += Number(ts.substr(i, 2)).toString(36);
  }

  return "MFA_" + out;
}

function validate_MFA(code) {
  bootbox.dialog({
    message:
      "<p>Type in your authenticator PIN code</p><input type='text' id='codeMFA'>",
    title: "Validate MFA code",
    onEscape: false,
    backdrop: false,
    closeButton: false,
    buttons: {
      cancel: {
        label: "Cancel",
        callback: function () {
          logout();
        },
      },
      send: {
        label: "Send",
        className: "btn-success",
        callback: function () {
          pin = $("#codeMFA").val();
          $.get("/validate_MFA", { pin: pin, code: code })
            .then(function (result) {
              if (result == "True") {
                USER_DATA["profile"]["MFA"] = {
                  code: code,
                  timestamp: Date.now(),
                };
                updated_profile = JSON.stringify(USER_DATA["profile"]);
                var form = new FormData();
                form.append("uid", JSON.parse(UID));
                form.append("user_dict", updated_profile);
                $.ajax({
                  url: "/save_profile_changes",
                  data: form,
                  type: "POST",
                  contentType: false,
                  processData: false,
                })
                  .done(function () {
                    alert("Login Succesful!");
                  })
                  .catch(function (error) {
                    alert(`error while verifying MFA: ${error}`);
                    logout();
                  });
              } else {
                alert("error while verifying MFA");
                logout();
              }
            })
            .catch(function (error) {
              console.log(error);
              logout();
            });
        },
      },
    },
  });
}

var USER_DATA = null;
var UID = null;

firebase.auth().onAuthStateChanged(function (user) {
  var create_article_btn = document.getElementById("create_article_btn");
  if (user) {
    $("#login_register_modal").modal("hide");
    if (!user.emailVerified) {
      bootbox.dialog({
        title: "Verify your Email",
        message:
          "<p>Please verify your email by clicking on verification email link that has been sent to your email upon registration.</p>",
        size: "large",
        onEscape: false,
        backdrop: false,
        closeButton: false,
        buttons: {
          cancel: {
            label: "Cancel",
            callback: function () {
              logout();
            },
          },
          send_email: {
            label: "Send email again",
            className: "btn-info",
            callback: function () {
              send_email_verification(user.email);
            },
          },
        },
      });
    } else {
      var profile = document.getElementById("noAvatar");
      var log_reg_list = document.getElementById("log_reg_list");
      create_article_btn.style.display = "block";
      log_reg_list.innerHTML =
        '<li><p>Welcome Back</p></li><li><button type="button" class="btn btn-secondary" id="logout_button" onclick="logout()">Logout</button></li>';
      profile.setAttribute("onclick", "javascript: load_feed('profile_view');");
      string_uid = JSON.stringify(user.uid);
      cached_uid = btoa(string_uid);
      localStorage.setItem("_uid", cached_uid);
      let email = user.email.toString();
      $.post("/get_user", { uid: string_uid, email: email }).done(function (
        user_data
      ) {
        if (user_data["profile"]["badge"] != "Banned User") {
          USER_DATA = user_data;
          string_user_data = JSON.stringify(USER_DATA);
          cached_user = btoa(string_user_data);
          localStorage.setItem("_user_data", cached_user);
          UID = string_uid;
          const MANDATORY_FIELDS = ["name", "surname"];
          for (var i = 0; i < MANDATORY_FIELDS.length; i++) {
            if (
              !USER_DATA["profile"][MANDATORY_FIELDS[i]] ||
              USER_DATA["profile"][MANDATORY_FIELDS[i]] == ""
            ) {
              load_feed("profile_view");
              break;
            }
          }
          if (
            !USER_DATA["profile"]["MFA"] ||
            !USER_DATA["profile"]["MFA"]["code"]
          ) {
            const MFA_CODE = generateUniqueString();
            bootbox.dialog({
              title: "Activate MFA",
              message: `<p>Multi Factor Authentication (MFA) is required when login. To setup MFA on your account, please download the app <b>Google Authenticator</b> on your phone, then scan the QR code below using the app:</p><div class="holds-the-iframe"><iframe src="https://www.authenticatorApi.com/pair.aspx?AppName=XXXRC&AppInfo=${user.uid}&SecretCode=${MFA_CODE}" alt="qr_code" height="350" width="350" title="QR_CODE"></iframe></div><h3>Once you have setup MFA on your smartphone, click on <b>Validate</b> to proceed.</h3><p>For more info on <b>Google Authenticator</b> app, follow the link:</p><a href="https://support.google.com/accounts/answer/1066447?hl=en&co=GENIE.Platform%3DAndroid" target="_blank">https://support.google.com/accounts/answer/1066447?hl=en&co=GENIE.Platform%3DAndroid<a>`,
              size: "large",
              onEscape: false,
              backdrop: false,
              closeButton: false,
              buttons: {
                cancel: {
                  label: "Cancel",
                  callback: function () {
                    logout();
                  },
                },
                validate: {
                  label: "Validate",
                  className: "btn-info",
                  callback: function () {
                    validate_MFA(MFA_CODE);
                  },
                },
              },
            });
          } else {
            if (
              Date.now() - USER_DATA["profile"]["MFA"]["timestamp"] >=
              24 * 1000 * 60 * 60
            ) {
              validate_MFA(USER_DATA["profile"]["MFA"]["code"].toString());
            }
          }
          if (USER_DATA["profile"]["badge"] == "Admin") {
            var topnav_buttons = document.getElementById("topnav_buttons");
            var secondnav_buttons =
              document.getElementById("secondnav_buttons");
            topnav_buttons.innerHTML +=
              "<a class='admin_page_btn' href='#' onclick='load_feed(\"admin\")'>Admin</a>";
            secondnav_buttons.innerHTML +=
              "<li><a class='admin_page_btn' href='#' onclick='load_feed(\"admin\")'>Admin</a></li>";
          }
          profile.innerHTML =
            "<img src='" + USER_DATA["profile"]["img"] + "' alt='noAvatar'>";
        } else {
          alert(
            "This user has been banned by an Admin or Moderator of the community."
          );
          logout();
        }
      });
    }
  } else {
    create_article_btn.style.display = "none";
    localStorage.removeItem("_uid");
    localStorage.removeItem("_user_data");
    localStorage.removeItem("_other_user_data");
    localStorage.removeItem("_otherID");
    USER_DATA = null;
    UID = null;
  }
});

function logout() {
  if (USER_DATA && USER_DATA["profile"]["MFA"]) {
    USER_DATA["profile"]["MFA"]["timestamp"] = 0;
    updated_profile = JSON.stringify(USER_DATA["profile"]);
    var form = new FormData();
    form.append("uid", JSON.parse(UID));
    form.append("user_dict", updated_profile);
    $.ajax({
      url: "/save_profile_changes",
      data: form,
      type: "POST",
      contentType: false,
      processData: false,
    })
      .done(function () {
        firebase
          .auth()
          .signOut()
          .then(function () {
            $("#login_register_modal").modal("hide");
            load_feed("dashboard");
            location.reload((forceGet = true));
          })
          .catch(function (error) {
            alert("error while logging out from firebase");
          });
      })
      .catch(function (error) {
        alert("error while logging out from firebase");
      });
  } else {
    firebase
      .auth()
      .signOut()
      .then(function () {
        $("#login_register_modal").modal("hide");
        load_feed("dashboard");
        location.reload((forceGet = true));
      })
      .catch(function (error) {
        alert("error while logging out from firebase");
      });
  }
}
