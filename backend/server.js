const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Debate = require('./models/Debate');
const { checkToxicity } = require('./utils/toxicity');

require('dotenv').config();

User.schema.add({
  totalWins: { type: Number, default: 0 }
});

const app = express();
const PORT = 5050;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/political-dialogue');

// Routes
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const onboardingCompleted = !!user.onboarding?.inferredIdeology;

    res.json({
      message: 'Login successful',
      user: {
        name: user.name,
        email: user.email,
        onboardingCompleted: onboardingCompleted,
        inferredIdeology: user.onboarding?.inferredIdeology || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create a new user
    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ message: 'Signup successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/onboarding', async (req, res) => {
  const { email, onboarding } = req.body;

  try {
    // Calculate political ideology
    const answers = Object.values(onboarding);
    const score = { Liberal: 0, Moderate: 0, Conservative: 0 };

    answers.forEach((answer) => {
      if (answer === 'Strongly Disagree') score.Conservative += 2;
      if (answer === 'Disagree') score.Conservative += 1;
      if (answer === 'Neutral') score.Moderate += 1;
      if (answer === 'Agree') score.Liberal += 1;
      if (answer === 'Strongly Agree') score.Liberal += 2;
    });

    const dominantIdeology = Object.entries(score).reduce(
      (a, b) => (b[1] > a[1] ? b : a),
      ['', 0]
    )[0];

    // Update user with onboarding data
    const user = await User.findOneAndUpdate(
      { email },
      {
        onboardingCompleted: true,
        onboarding: {
          inferredIdeology: dominantIdeology,
          ideologyScore: score,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log the results to the terminal
    console.log(`✅ Updated onboarding info for ${email}:`);
    console.log(`Inferred Ideology: ${dominantIdeology}`);
    console.log('Ideology Score:', score);
    console.log('Answers:', onboarding);

    res.json({ message: 'Onboarding processed successfully', inferredIdeology: dominantIdeology });
  } catch (err) {
    console.error('❌ Error processing onboarding:', err);
    res.status(500).json({ message: 'Failed to process onboarding' });
  }
});

// http://localhost:5050/api/users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude passwords
    const usersWithIdeology = users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      onboardingCompleted: user.onboardingCompleted,
      inferredIdeology: user.onboarding?.inferredIdeology || null,
      ideologyScore: user.onboarding?.ideologyScore || null,
      totalWins: user.totalWins || 0
    }));
    res.json(usersWithIdeology);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// curl -X DELETE http://localhost:5050/api/<user-id>
app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

app.delete('/api/users', async (req, res) => {
  try {
    await User.deleteMany({});
    res.json({ message: 'All users deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete all users' });
  }
});

// Get all active debate matches
app.get('/api/debates', async (req, res) => {
  try {
    const debates = await Debate.find()
      .populate('user1', 'name email onboarding.inferredIdeology totalWins')
      .populate('user2', 'name email onboarding.inferredIdeology totalWins');
    res.json(debates);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch debates' });
  }
});

// Get debates for a specific user
app.get('/api/debates/user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const debates = await Debate.find({ 
      $or: [{ user1: user._id }, { user2: user._id }]
    })
      .populate('user1', 'name email onboarding.inferredIdeology totalWins')
      .populate('user2', 'name email onboarding.inferredIdeology totalWins');
    
    res.json(debates);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user debates' });
  }
});

// Enter matchmaking queue
app.post('/api/debates/matchmaking', async (req, res) => {
  const { email } = req.body;

  try {
    // Find user who wants to enter matchmaking
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already in a debate
    const existingDebate = await Debate.findOne({
      $or: [{ user1: user._id }, { user2: user._id }],
      status: { $in: ['waiting', 'active'] }
    });

    if (existingDebate) {
      return res.status(400).json({ message: 'You are already in an active debate or matchmaking queue' });
    }

    // Look for existing user in the matchmaking queue with different ideology
    const matchmakingDebate = await Debate.findOne({
      user2: null,
      status: 'waiting'
    }).populate('user1', 'onboarding.inferredIdeology');

    // If there's a suitable match in the queue
    if (matchmakingDebate && matchmakingDebate.user1.onboarding.inferredIdeology !== user.onboarding.inferredIdeology) {
      // Create a matched debate
      matchmakingDebate.user2 = user._id;
      matchmakingDebate.status = 'active';
      matchmakingDebate.startTime = new Date();
      matchmakingDebate.endTime = new Date(Date.now() + 60 * 1000);
      matchmakingDebate.topic = getRandomDebateTopic();
      
      await matchmakingDebate.save();
      
      return res.json({ 
        matched: true, 
        debate: matchmakingDebate 
      });
    }

    // No match found, add user to matchmaking queue
    const newDebate = new Debate({
      user1: user._id,
      user2: null,
      status: 'waiting',
      topic: null,
      messages: [],
      startTime: new Date(),
      endTime: null
    });

    await newDebate.save();

    res.json({ 
      matched: false, 
      message: 'Added to matchmaking queue',
      debate: newDebate
    });
  } catch (err) {
    console.error('Matchmaking error:', err);
    res.status(500).json({ message: 'Matchmaking failed' });
  }
});

// Add message to debate
app.post('/api/debates/:id/message', async (req, res) => {
  const { id } = req.params;
  const { email, message } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const debate = await Debate.findById(id);
    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }

    // Verify user is part of this debate
    if (!debate.user1.equals(user._id) && !debate.user2?.equals(user._id)) {
      return res.status(403).json({ message: 'You are not authorized to participate in this debate' });
    }

    // Check if debate has ended
    if (debate.status === 'completed') {
      return res.status(400).json({ message: 'This debate has ended' });
    }

    // Check message toxicity
    const toxicityResult = await checkToxicity(message);
    
    if (toxicityResult.isToxic) {
      return res.status(400).json({ 
        message: 'Your message was flagged as inappropriate. Please revise and try again.',
        toxicityScores: toxicityResult.scores 
      });
    }

    // Add message to debate
    debate.messages.push({
      userId: user._id,
      content: message,
      timestamp: new Date()
    });

    await debate.save();
    res.json({ message: 'Message added' });
  } catch (err) {
    console.error('Error adding message:', err);
    res.status(500).json({ message: 'Failed to add message' });
  }
});

// Check matchmaking status
app.get('/api/debates/matchmaking/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const debate = await Debate.findOne({
      user1: user._id,
      status: 'waiting'
    });

    if (!debate) {
      return res.json({ inQueue: false });
    }

    res.json({ inQueue: true, debate });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check matchmaking status' });
  }
});

// Vote on a debate
app.post('/api/debates/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { email, votedFor } = req.body;
  
  try {
    console.log(`VOTE: User ${email} is voting for ${votedFor} in debate ${id}`);
    
    const debate = await Debate.findById(id);
    if (!debate) {
      console.log('VOTE ERROR: Debate not found');
      return res.status(404).json({ message: 'Debate not found' });
    }
    
    if (debate.status !== 'completed') {
      console.log('VOTE ERROR: Debate still in progress');
      return res.status(400).json({ message: 'Debate is still in progress' });
    }
    
    // prevent double voting
    if (debate.voters.includes(email)) {
      console.log(`VOTE INFO: User ${email} already voted on this debate`);
      return res.status(400).json({ message: 'You have already voted on this debate' });
    }
    
    // record vote
    if (votedFor === 'user1') {
      debate.votes.user1 += 1;
      console.log(`VOTE: Incrementing vote for user1, new total: ${debate.votes.user1}`);
    } else if (votedFor === 'user2') {
      debate.votes.user2 += 1;
      console.log(`VOTE: Incrementing vote for user2, new total: ${debate.votes.user2}`);
    }
    
    debate.voters.push(email);
    await debate.save();
    console.log(`VOTE: Vote recorded successfully. Current totals - user1: ${debate.votes.user1}, user2: ${debate.votes.user2}`);
    
    res.json({ message: 'Vote recorded' });
  } catch (err) {
    console.error('VOTE ERROR:', err);
    res.status(500).json({ message: 'Failed to record vote' });
  }
});

// Add a route to mark debates as completed when time expires
app.post('/api/debates/:id/complete', async (req, res) => {
  const { id } = req.params;
  
  try {
    const debate = await Debate.findById(id);
    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }
    
    if (debate.status !== 'active') {
      return res.status(400).json({ message: 'Only active debates can be completed' });
    }
    
    debate.status = 'completed';
    await debate.save();
    
    res.json({ message: 'Debate marked as completed', debate });
  } catch (err) {
    res.status(500).json({ message: 'Failed to complete debate' });
  }
});

// Update the vote route to record wins after voting period ends
app.post('/api/debates/:id/tally-votes', async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log(`TALLY: Processing vote tally for debate ${id}`);
    
    const debate = await Debate.findById(id)
      .populate('user1', 'name email totalWins')
      .populate('user2', 'name email totalWins');
      
    if (!debate) {
      console.log(`TALLY ERROR: Debate ${id} not found`);
      return res.status(404).json({ message: 'Debate not found' });
    }
    
    if (debate.status !== 'completed') {
      console.log(`TALLY ERROR: Debate ${id} is not completed yet`);
      return res.status(400).json({ message: 'Only completed debates can have votes tallied' });
    }

    // Check if voting has already ended
    if (debate.votingEnded) {
      console.log(`TALLY INFO: Voting has already ended for debate ${id}`);
      return res.json({ 
        message: 'Votes already tallied',
        votingEnded: true,
        user1Votes: debate.votes.user1,
        user2Votes: debate.votes.user2
      });
    }
    
    console.log(`TALLY: Current vote counts - user1 (${debate.user1.name}): ${debate.votes.user1}, user2 (${debate.user2.name}): ${debate.votes.user2}`);
    
    // Determine winner
    let winnerId = null;
    let winnerName = null;
    if (debate.votes.user1 > debate.votes.user2) {
      winnerId = debate.user1._id;
      winnerName = debate.user1.name;
    } else if (debate.votes.user2 > debate.votes.user1) {
      winnerId = debate.user2._id;
      winnerName = debate.user2.name;
    }
    
    // If we have a winner, increment their win count
    if (winnerId) {
      console.log(`TALLY: Winner determined - ${winnerName} (ID: ${winnerId})`);
      console.log(`TALLY: Before update, winner has ${winnerId.equals(debate.user1._id) ? debate.user1.totalWins : debate.user2.totalWins} wins`);
      
      const updateResult = await User.findByIdAndUpdate(
        winnerId,
        { $inc: { totalWins: 0.5 } },
        { new: true }
      );
      
      console.log(`TALLY: After update, winner now has ${updateResult.totalWins} wins`);
    } else {
      console.log(`TALLY: No winner determined - debate ended in a tie`);
    }
    
    debate.votingEnded = true;
    await debate.save();
    console.log(`TALLY: Debate ${id} marked as voting ended`);
    
    res.json({ 
      message: 'Votes tallied successfully', 
      winnerId,
      winnerName,
      user1Votes: debate.votes.user1,
      user2Votes: debate.votes.user2,
      tie: !winnerId
    });
  } catch (err) {
    console.error('TALLY ERROR:', err);
    res.status(500).json({ message: 'Failed to tally votes' });
  }
});

// Add a new route to delete a debate permanently
app.delete('/api/debates/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const debate = await Debate.findByIdAndDelete(id);
    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }
    
    res.json({ message: 'Debate deleted successfully' });
  } catch (err) {
    console.error('Error deleting debate:', err);
    res.status(500).json({ message: 'Failed to delete debate' });
  }
});

// Helper function for random debate topics
function getRandomDebateTopic() {
  const topics = [
    "Should the government provide universal healthcare?",
    "Is nuclear energy the solution to climate change?",
    "Should college education be free for all citizens?",
    "Should the minimum wage be raised to $15 per hour?",
    "Should social media platforms be regulated like public utilities?",
    "Should the electoral college be abolished?",
    "Is capitalism the best economic system?",
    "Should recreational marijuana be legalized nationwide?",
    "Should the United States adopt stricter gun control laws?",
    "Should the government implement a universal basic income?",
    "Are charter schools better than public schools?",
    "Should the United States have a single-payer healthcare system?",
    "Should the voting age be lowered to 16?",
    "Should the Supreme Court have term limits?",
    "Is a flat tax system fairer than a progressive tax system?"
  ];
  
  return topics[Math.floor(Math.random() * topics.length)];
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});