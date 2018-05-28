////////////////////////////////////////////////////////////////////////////////////////////////////////
// MONZO OAUTH
//
//From https://github.com/Andy-EOS/Monzo-Google-Sheets
////////////////////////////////////////////////////////////////////////////////////////////////////////

function returnURL() {
  
  // Get variables first from the cache, then the properties service if that fails
  var scriptProperties = PropertiesService.getScriptProperties();
  var sCache = CacheService.getScriptCache();
  var client_id = sCache.get("client_id") ? sCache.get("client_id") : scriptProperties.getProperty('client_id');
  var redirect_uri = sCache.get("redirect_uri") ? sCache.get("redirect_uri") : scriptProperties.getProperty('redirect_uri');
  sCache.putAll({"client_id" : client_id,
                 "redirect_uri" : redirect_uri}, 21000); //5hrs 50.
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  // Set fixed variables
  var response_type = 'code';
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  //Generate a random string to use as the state token and store it in the properties service
  var state_token = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < 500; i++ ){
      state_token += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  scriptProperties.setProperty('state_token', state_token);
  

  
// Generate the URL and log it for copying into a browser  
  var url = 'https://auth.getmondo.co.uk/?client_id='+client_id+'&redirect_uri='+redirect_uri+'&response_type=code&state='+state_token;
  
  Logger.log(url)
  return(0);
}

/*--------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------------------------*/

function doGet(e){
 
  // Get variables first from the cache, then the properties service if that fails
  var scriptProperties = PropertiesService.getScriptProperties();
  var sCache = CacheService.getScriptCache();
  var cached = sCache.getAll(["client_id","client_secret","redirect_uri","state_token"]);
  var client_id = cached ? cached.client_id : null;
  var client_secret = cached ? cached.client_secret : null;
  var redirect_uri = cached ? cached.redirect_uri : null;
  var state_token = cached ? cached.state_token : null;
  
  if(client_id==null || client_secret==null || redirect_uri==null || state_token==null){
   var allProps = scriptProperties.getProperties();
    client_id = allProps.client_id;
    client_secret = allProps.client_secret;
    redirect_uri = allProps.redirect_uri;
    state_token = allProps.state_token;
    sCache.putAll({"client_id":client_id,"client_secret":client_secret,"redirect_uri":redirect_uri,"state_token":state_token},3600);//1 hr
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  // Define fixed variables
  var method = 'post'
  var grant_type = 'authorization_code'

  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  // Get variables from the URL
  var code = e.parameter.code;
  var state = e.parameter.state;
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  // Define the payload
  var payload = {
     'grant_type':grant_type,
    'client_id':client_id,
    'client_secret':client_secret,
    'redirect_uri':redirect_uri,
    'code':code
  };
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
 // Define headers 
  
  var headers = {

  };
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  // Send a post request to swap the code for a token if the state token is valis
      var url = 'https://api.monzo.com/oauth2/token';
  var options = {
    'method': method,
    'headers': headers,
    'payload': payload
};
  
  if(state_token == state){
    var response = UrlFetchApp.fetch(url,options).getContentText();
  }else{
    return ContentService.createTextOutput("Invalid state token, authentication cancelled");
  }
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  // Retreive the needed data from the JSON response
  var data = JSON.parse(response);
  
  var token = data.access_token;
  var expires_in = data.expires_in;
  var refresh_token = data.refresh_token;
  
  // Calculate the time for refreshing the token
  var d = new Date();
  var timeStamp = d.getTime();  // Number of ms since Jan 1, 1970
  var expires = timeStamp + ((expires_in*1000)-(10*60*1000));  //Set the expiry time to 10 minutes before the token expires on the Monzo servers

  // Store the nescesary data in the properties service
  scriptProperties.setProperties({'token': token,
   'expires_in': expires_in,
   'refresh_token': refresh_token,
     'token_expiry_time': expires}, false);
  ////////////////////////////////////////////////////////////////////////////////////////////////////////

    return ContentService.createTextOutput("Authentication complete");
}

/*--------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------------------------*/

function refreshToken() {
  var scriptProperties = PropertiesService.getScriptProperties();
  // get values from cache
  var sCache = CacheService.getScriptCache();
  var cached = sCache.getAll(["token","expires_in","refresh_token","client_id","client_secret","token_expiry_time"]);
  var token = cached ? cached.token : null,
      expires_in = cached ? cached.expires_in : null,
      refresh_token = cached ? cached.refresh_token : null,
      client_id = cached ? cached.client_id : null,
      client_secret = cached ? cached.client_secret : null,
      token_expiry_time = cached ? cached.token_expiry_time : null;
  //if cache fails for any values, update all from one properties call.
  if(token==null || expires_in==null || refresh_token==null || client_id==null || client_secret==null || token_expiry_time==null){
    //Get variables from the properties service
   var allProps = scriptProperties.getProperties();
    token = allProps.token;
    expires_in = allProps.expires_in;
    refresh_token = allProps.refresh_token;
    client_id = allProps.client_id;
    client_secret = allProps.client_secret;
    token_expiry_time = allProps.token_expiry_time;
    sCache.putAll({"token" : token,
                   "expires_in" : expires_in,
                   "refresh_token" : refresh_token,
                   "client_id": client_id,
                   "client_secret":client_secret,
                   "token_expiry_time":token_expiry_time
                  },3600);//1 hr
  }    
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  
  //Define fixed variables
  var grant_type = "refresh_token";
  var method = 'post';
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  //Define payload 
  var payload = {
     'grant_type':grant_type,
    'client_id':client_id,
    'client_secret':client_secret,
    'refresh_token':refresh_token
  };
  ////////////////////////////////////////////////////////////////////////////////////////////////////////

  //Define headers 
  var headers = {

  };
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  //Send the post request to refresh the token if it is within 10 minutes of expiry.
    var d = new Date();
  var timeStamp = d.getTime();  // Number of ms since Jan 1, 1970
      var url = 'https://api.monzo.com/oauth2/token';
  var options = {

    'method': method,
    'headers': headers,
    'payload': payload

};
  if(timeStamp > token_expiry_time){
    var response = UrlFetchApp.fetch(url,options).getContentText();
    Logger.log("token refreshed");
  }else{
    Logger.log("refresh not yet required");
    return(1);
  };
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  //Retreive the data from the JSON response
  var data = JSON.parse(response);
  
  token = data.access_token;
  expires_in = data.expires_in;
  refresh_token = data.refresh_token;
  ////////////////////////////////////////////////////////////////////////////////////////////////////////
  
    // Calculate the time for refreshing the token
  var d = new Date();
  var timeStamp = d.getTime();  // Number of ms since Jan 1, 1970
  var expires = timeStamp + ((expires_in*1000)-(10*60*1000));  //Set the expiry time to 10 minutes before the token expires on the Monzo servers

  //Add the required response data to the properties service for future use
  scriptProperties.setProperties({'token': token,
    'expires_in': expires_in,
      'refresh_token': refresh_token,
        'token_expiry_time': expires});
  return(0);
}
