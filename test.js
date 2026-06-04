fetch('https://sabbath-school.adventech.io/api/v1/en/quarters/current/lessons/current')
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(console.error);
