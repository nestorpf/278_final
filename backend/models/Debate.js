const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  content: { 
    type: String,
    required: true 
  },
  timestamp: { 
    type: Date,
    default: Date.now 
  }
});

const debateSchema = new mongoose.Schema({
  user1: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  user2: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  },
  topic: { 
    type: String,
    default: null
  },
  status: { 
    type: String,
    enum: ['waiting', 'active', 'completed'],
    default: 'waiting'
  },
  messages: [messageSchema],
  startTime: { 
    type: Date,
    required: true
  },
  endTime: { 
    type: Date,
    default: null
  },
  votes: {
    user1: { type: Number, default: 0 },
    user2: { type: Number, default: 0 }
  },
  voters: { type: [String], default: [] },  // store emails of users who've voted
  votingEnded: { type: Boolean, default: false },
});

module.exports = mongoose.model('Debate', debateSchema);