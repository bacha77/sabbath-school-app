const URL = "https://jyjqhfpmvvfxxvoezeio.supabase.co/rest/v1/teachers";
const KEY = "sb_publishable_o-_mOOQSSqVCg2EGcEsSHw_MWywLWCy";

fetch(URL, {
  method: 'POST',
  headers: {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    church_id: "11111111-1111-1111-1111-111111111111",
    name: "Test",
    pin: "1234",
    assigned_class: "Class 1"
  })
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(err => console.error(err));
