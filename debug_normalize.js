const fixPath = (filePath = '') => filePath.replace(/\\/g, '/');
const normalizeUploadUrl = (file, host = 'localhost:3000') => {
  if (!file) return null;
  const normalized = fixPath(file);
  const uploadsIndex = normalized.toLowerCase().indexOf('uploads/');
  const relativePath = uploadsIndex >= 0 ? normalized.slice(uploadsIndex) : normalized;
  return `http://${host}/${relativePath}`;
};

const samples = [
  'uploads\\venues\\file.jpg',
  'uploads/venues/file.jpg',
  'D:\\project\\server\\uploads\\venues\\file.jpg',
  'C:/project/server/uploads/venues/file.jpg',
  '/uploads/venues/file.jpg',
  'http://localhost:3000/uploads/venues/file.jpg',
];

samples.forEach((s) => console.log(s, '=>', normalizeUploadUrl(s)));
