const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  onboardingCompleted: { type: Boolean, default: false },
  onboarding: {
    ideology: String,
    govRole: String,
    socialIssues: String,
    inferredIdeology: String
  },
  totalWins: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);

