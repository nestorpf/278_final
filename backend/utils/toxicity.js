const Perspective = require('perspective-api-client');
require('dotenv').config();

const perspective = new Perspective({ apiKey: process.env.PERSPECTIVE_API_KEY });

async function checkToxicity(text) {
  try {
    const result = await perspective.analyze(text, {
      attributes: ['TOXICITY', 'SEVERE_TOXICITY', 'IDENTITY_ATTACK', 'INSULT', 'THREAT'],
      languages: ['en'],
      doNotStore: true
    });

    // Get scores
    const scores = {
      toxicity: result.attributeScores.TOXICITY.summaryScore.value,
      severeToxicity: result.attributeScores.SEVERE_TOXICITY.summaryScore.value,
      identityAttack: result.attributeScores.IDENTITY_ATTACK.summaryScore.value,
      insult: result.attributeScores.INSULT.summaryScore.value,
      threat: result.attributeScores.THREAT.summaryScore.value
    };

    // Message is toxic if any score is above threshold
    const THRESHOLD = 0.8;
    const isToxic = Object.values(scores).some(score => score > THRESHOLD);

    return {
      isToxic,
      scores
    };
  } catch (error) {
    console.error('Error checking toxicity:', error);
    // In case of API error, let message through but log error
    return {
      isToxic: false,
      scores: null,
      error: error.message
    };
  }
}

module.exports = { checkToxicity };
