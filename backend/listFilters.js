const mongoose = require('mongoose');
const Filter = require('./models/Filter');

mongoose.connect('mongodb://localhost:27017/laptop-shop')
.then(async () => {
  const allFilters = await Filter.find({}).sort({ category: 1, order: 1 });
  console.log('All Filters:');
  allFilters.forEach(f => {
    console.log(`  ${f.category || 'ALL'} - ${f.displayName} (${f.name}): ${f.options.length} options, order: ${f.order}`);
  });
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
