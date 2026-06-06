const URL = "https://jyjqhfpmvvfxxvoezeio.supabase.co/rest/v1/churches?select=*";
const KEY = "sb_publishable_o-_mOOQSSqVCg2EGcEsSHw_MWywLWCy";

fetch(URL, {
  method: 'GET',
  headers: {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY
  }
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(err => console.error(err));
