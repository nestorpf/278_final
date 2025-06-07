import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const questions = [
  { key: 'question1', question: 'Do you support universal healthcare?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question2', question: 'Should taxes on the wealthy be increased?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question3', question: 'Do you support stricter gun control laws?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question4', question: 'Should the government invest more in renewable energy?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question5', question: 'Do you support free college tuition?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question6', question: 'Should the government increase military spending?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question7', question: 'Do you support raising the minimum wage?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question8', question: 'Should abortion be legal in all cases?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question9', question: 'Do you support stricter immigration policies?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question10', question: 'Should the government regulate big tech companies more?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question11', question: 'Do you support the legalization of recreational marijuana?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question12', question: 'Should the government provide universal basic income?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question13', question: 'Do you support privatizing Social Security?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question14', question: 'Should the government ban assault weapons?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question15', question: 'Do you support increasing funding for public schools?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question16', question: 'Should the government implement a carbon tax?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question17', question: 'Do you support the death penalty?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question18', question: 'Should the government provide paid parental leave?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question19', question: 'Do you support stricter voter ID laws?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question20', question: 'Should the government increase funding for police departments?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question21', question: 'Do you support expanding the Supreme Court?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question22', question: 'Should the government provide free childcare?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question23', question: 'Do you support mandatory national service?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question24', question: 'Should the government ban single-use plastics?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question25', question: 'Do you support stricter campaign finance laws?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question26', question: 'Should the government increase funding for mental health services?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question27', question: 'Do you support the use of nuclear energy?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question28', question: 'Should the government regulate social media platforms?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question29', question: 'Do you support term limits for Congress?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
  { key: 'question30', question: 'Should the government increase foreign aid spending?', options: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'] },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const submitAnswers = async (finalAnswers) => {
    const email = localStorage.getItem('email');
    setIsSubmitting(true);

    try {
      const res = await fetch('http://localhost:5050/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          onboardingCompleted: true,
          onboarding: finalAnswers,
        }),
      });

      if (res.ok) {
        setTimeout(() => {
          navigate('/home');
        }, 2000);
      }
    } catch (error) {
      alert('Failed to submit onboarding.');
    }
  };

  const handleSelect = (value) => {
    const key = questions[currentStep].key;
    setAnswers((prev) => ({ ...prev, [key]: value }));

    if (currentStep + 1 < questions.length) {
      setCurrentStep(currentStep + 1);
    } else {
      submitAnswers({ ...answers, [key]: value });
    }
  };

  const currentQ = questions[currentStep];

  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      {isSubmitting ? (
        <h2 style={{ fontSize: '1.8rem' }}>Thanks! Redirecting to your home page...</h2>
      ) : (
        <>
          <h2 style={{ marginBottom: '30px', fontSize: '2rem' }}>{currentQ.question}</h2>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '15px', justifyContent: 'center' }}>
            {currentQ.options.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                style={{
                  padding: '12px 24px',
                  fontSize: '1.1rem',
                  backgroundColor: '#4CAF50',
                  border: '1px solid white',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  minWidth: '150px',
                }}
              >
                {option}
              </button>
            ))}
          </div>
          <p style={{ marginTop: '40px', fontSize: '0.9rem', color: '#ccc' }}>
            Question {currentStep + 1} of {questions.length}
          </p>
        </>
      )}
    </div>
  );
}