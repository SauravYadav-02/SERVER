import http from 'http';

http.get('http://192.168.1.4:3000/terms/active', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    console.log('BODY:', data);
  });
}).on('error', (err) => {
  console.error('ERROR:', err.message);
});
