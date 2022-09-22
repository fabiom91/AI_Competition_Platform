// Your web app's Firebase configuration
import firebase_config from './firebase_config.json' assert { type: 'JSON' };

// Initialize Firebase
firebase.initializeApp(firebase_config);
firebase.analytics();
var auth = firebase.auth();
