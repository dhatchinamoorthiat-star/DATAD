require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await User.updateOne(
    { email: 'pitchdemo0813@example.com' },
    { $set: { emailVerifiedAt: new Date() } }
  );
  console.log(JSON.stringify(res));
  await mongoose.disconnect();
})();
