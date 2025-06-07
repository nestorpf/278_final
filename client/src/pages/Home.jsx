import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [featuredDebates, setFeaturedDebates] = useState([]);
  const [myDebates, setMyDebates] = useState([]);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [userInfo, setUserInfo] = useState({ ideology: null, name: '', totalWins: 0 });
  const [activeDebate, setActiveDebate] = useState(null);
  const [debateMessage, setDebateMessage] = useState('');
  const [pollInterval, setPollInterval] = useState(null);
  const [votedDebates, setVotedDebates] = useState([]);
  const [dismissedDebates, setDismissedDebates] = useState([]);
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
  const email = localStorage.getItem('email');
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const removeMyDebate = async (id) => {
    try {
      // Make API call to permanently delete the debate
      const response = await fetch(`http://localhost:5050/api/debates/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        // Still update local state as before
        setDismissedDebates(prev => [...prev, id]);
        setMyDebates(prev => prev.filter(d => d.id !== id));
        console.log('Debate permanently deleted');
      } else {
        console.error('Failed to delete debate');
      }
    } catch (error) {
      console.error('Error deleting debate:', error);
    }
  };

  // Load dismissed debates from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dismissedDebates');
    if (saved) {
      try { setDismissedDebates(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Save dismissed debates to localStorage
  useEffect(() => {
    localStorage.setItem('dismissedDebates', JSON.stringify(dismissedDebates));
  }, [dismissedDebates]);

  // Initial data loading
  useEffect(() => {
    if (!email) {
      navigate('/login');
      return;
    }
    
    // Load previously voted debates from localStorage
    const savedVotes = localStorage.getItem('votedDebates');
    if (savedVotes) {
      try {
        setVotedDebates(JSON.parse(savedVotes));
      } catch (e) {
        console.error('Error parsing saved votes:', e);
      }
    }
    
    // Fetch user data, featured debates, and user debates
    const fetchInitialData = async () => {
      try {
        // Fetch user data
        const userResponse = await fetch(`http://localhost:5050/api/users`);
        if (userResponse.ok) {
          const users = await userResponse.json();
          const currentUser = users.find(user => user.email === email);
          if (currentUser) {
            console.log("Initial user data:", currentUser);
            setUserInfo({
              ideology: currentUser.inferredIdeology || currentUser.onboarding?.inferredIdeology || null,
              name: currentUser.name || '',
              totalWins: currentUser.totalWins || 0
            });
          }
        }
        
        // Fetch featured debates
        const featuredResponse = await fetch('http://localhost:5050/api/debates');
        if (featuredResponse.ok) {
          const debates = await featuredResponse.json();
          // Filter to show only completed debates for featuring
          const completedDebates = debates.filter(debate => 
            debate.status === 'completed'
          ).map(debate => ({
            id: debate._id,
            topic: debate.topic,
            user1: { 
              name: debate.user1.name,
              id: debate.user1._id,
              ideology: debate.user1.onboarding?.inferredIdeology || 'Unknown',
              totalWins: debate.user1.totalWins || 0
            },
            user2: { 
              name: debate.user2.name,
              id: debate.user2._id, 
              ideology: debate.user2.onboarding?.inferredIdeology || 'Unknown',
              totalWins: debate.user2.totalWins || 0
            },
            snippet: debate.messages.slice(0, 2).map(m => m.content).join(' ... '),
            votes: debate.votes,
            expanded: false,
            messages: debate.messages,
            votingEnded: debate.votingEnded || false,
            endTime: debate.endTime
          }));
          
          // Immediately filter out any already expired debates
          const now = new Date();
          const freshDebates = completedDebates.filter(debate => {
            const debateCompletedTime = new Date(debate.endTime);
            const secondsPassed = (now - debateCompletedTime) / 1000;
            return secondsPassed < 60;
          });
          setFeaturedDebates(freshDebates);

          // For any already expired debates, make the API call to tally votes
          completedDebates.forEach(debate => {
            const debateCompletedTime = new Date(debate.endTime);
            const secondsPassed = (now - debateCompletedTime) / 1000;
            if (secondsPassed >= 60 && !debate.votingEnded) {
              fetch(`http://localhost:5050/api/debates/${debate.id}/tally-votes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
              }).catch(error => console.error('Error tallying votes:', error));
            }
          });
        }
        
        // Fetch user debates
        const userDebatesResponse = await fetch(`http://localhost:5050/api/debates/user/${email}`);
        if (userDebatesResponse.ok) {
          const debates = await userDebatesResponse.json();
          const formattedDebates = debates.map(debate => {
            // Determine if current user is user1 or user2
            const isUser1 = debate.user1.email === email;
            const opponent = isUser1 ? debate.user2 : debate.user1;
            
            // Determine win/loss status for completed debates
            let result = null;
            if (debate.status === 'completed') {
              if (debate.votes.user1 === debate.votes.user2) {
                result = 'tie';
              } else {
                const user1Won = debate.votes.user1 > debate.votes.user2;
                result = (isUser1 && user1Won) || (!isUser1 && !user1Won) ? 'won' : 'lost';
              }
            }

            // Calculate time remaining if debate is active
            let timeRemaining = '';
            if (debate.status === 'active' && debate.endTime) {
              const endTime = new Date(debate.endTime);
              const now = new Date();
              const diffMs = endTime - now;
              if (diffMs > 0) {
                // Just display seconds for testing
                const diffSecs = Math.floor(diffMs / 1000);
                timeRemaining = `${diffSecs}s`;
                
                if (diffMs < 1000 && diffMs > 0) {
                  // Schedule debate completion a little after time expires
                  setTimeout(async () => {
                    try {
                      const completeResponse = await fetch(`http://localhost:5050/api/debates/${debate._id}/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                      });
                      
                      if (completeResponse.ok) {
                        console.log('Debate completed automatically');
                      }
                    } catch (error) {
                      console.error('Error completing debate:', error);
                    }
                  }, diffMs + 1000);
                }
              } else {
                timeRemaining = 'Ended';
                
                // Auto-complete if needed
                if (debate.status === 'active') {
                  fetch(`http://localhost:5050/api/debates/${debate._id}/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                  }).catch(error => {
                    console.error('Error completing debate:', error);
                  });
                }
              }
            }
            
            return {
              id: debate._id,
              topic: debate.topic || 'Waiting for match...',
              opponent: opponent ? {
                id: opponent._id,
                name: opponent.name,
                ideology: opponent.onboarding?.inferredIdeology || 'Unknown',
                totalWins: opponent.totalWins || 0
              } : null,
              status: debate.status === 'waiting' ? 'Matchmaking' : debate.status === 'active' ? 'Active' : 'Completed',
              timeRemaining,
              messages: debate.messages,
              startTime: debate.startTime,
              endTime: debate.endTime,
              expanded: false,
              votes: debate.votes,
              votingEnded: debate.votingEnded,
              result // Always include result, even if null
            };
          });
          
          setMyDebates(formattedDebates.filter(d => !dismissedDebates.includes(d.id)));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    fetchInitialData();
    
    const timerUpdateInterval = setInterval(() => {
      // Update countdown timers in featured debates and remove expired ones
      setFeaturedDebates(prev => {
        // Filter out any debates whose time has expired
        const now = new Date();
        return prev
          .filter(debate => {
            const endTime = new Date(debate.endTime);
            // Keep debates that still have time remaining for voting
            const secondsPassed = (now - endTime) / 1000;
            const hasTimeRemaining = secondsPassed < 60;
            
            // If debate just expired, make a final tally-votes call
            if (!hasTimeRemaining && !debate.votingEnded) {
              console.log('Debate expired, triggering final vote tally:', debate.id);
              
              const winner = debate.votes.user1 > debate.votes.user2 ? 'user1' : 
                            debate.votes.user2 > debate.votes.user1 ? 'user2' : null;
              
              if (winner) {
                console.log(`${winner === 'user1' ? debate.user1.name : debate.user2.name} won the debate!`);
              } else {
                console.log('The debate ended in a tie!');
              }
              
              // Make API call to tally votes and update winner's score in database
              fetch(`http://localhost:5050/api/debates/${debate.id}/tally-votes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
              })
              .then(response => response.json())
              .then(result => {
                console.log('Vote tally result:', result);
                
                if (result.debateId || result.winnerId) { // Check for either debateId or winnerId
                  console.log("Processing tally result with winnerId:", result.winnerId);
                  
                  // Immediately update myDebates to show win/loss status based on the tally result
                  setMyDebates(prevDebates => {
                    return prevDebates.map(debate => {
                      // Match either by debateId or directly by id
                      const debateId = result.debateId || debate.id;
                      if (debate.id === debateId) {
                        // Determine if current user won
                        const isUser1 = debate.opponent ? true : false; // If opponent exists, user is user1
                        const userWon = (isUser1 && result.winnerId === debate.user1?.id) || 
                                        (!isUser1 && result.winnerId === debate.opponent?.id);
                        
                        console.log(`Debate ${debate.id}: isUser1=${isUser1}, userWon=${userWon}, result=${result.tie ? 'tie' : (userWon ? 'won' : 'lost')}`);
                        
                        return {
                          ...debate,
                          result: result.tie ? 'tie' : (userWon ? 'won' : 'lost'),
                          votingEnded: true
                        };
                      }
                      return debate;
                    });
                  });
                  
                  // Force a manual refresh of user data to update win counts
                  console.log("Refreshing user data to update win counts...");
                  fetch(`http://localhost:5050/api/users`)
                    .then(res => res.ok ? res.json() : null)
                    .then(users => {
                      if (users) {
                        // Update current user info if they won
                        const currentUser = users.find(user => user.email === email);
                        if (currentUser) {
                          console.log('Updated user data received:', currentUser);
                          console.log(`Total wins for ${currentUser.name}: ${currentUser.totalWins}`);
                          
                          setUserInfo({
                            ideology: currentUser.inferredIdeology || currentUser.onboarding?.inferredIdeology || null,
                            name: currentUser.name || '',
                            totalWins: currentUser.totalWins || 0
                          });
                        }
                        
                        // Also update the win counts in featured debates
                        setFeaturedDebates(prevDebates => {
                          return prevDebates.map(featuredDebate => {
                            // Update user1 and user2's win counts if they are in the users list
                            const user1 = users.find(user => user._id === featuredDebate.user1.id);
                            const user2 = users.find(user => user._id === featuredDebate.user2.id);
                            
                            return {
                              ...featuredDebate,
                              user1: {
                                ...featuredDebate.user1,
                                totalWins: user1 ? user1.totalWins : featuredDebate.user1.totalWins
                              },
                              user2: {
                                ...featuredDebate.user2,
                                totalWins: user2 ? user2.totalWins : featuredDebate.user2.totalWins
                              }
                            };
                          });
                        });
                      }
                    })
                    .catch(err => {
                      console.error("Error fetching updated user data:", err);
                    });
                }
              })
              .catch(error => console.error('Error tallying votes:', error));
            }
            
            return hasTimeRemaining;
          })
          .map(debate => ({ ...debate }));
      });
      
      // Update timers for active debates
      if (activeDebate && activeDebate.status === 'Active' && activeDebate.endTime) {
        setActiveDebate(prev => {
          const endTime = new Date(prev.endTime);
          const now = new Date();
          const diffMs = endTime - now;
          if (diffMs > 0) {
            const diffSecs = Math.floor(diffMs / 1000);
            return {
              ...prev,
              timeRemaining: `${diffSecs}s`
            };
          } else {
            return {
              ...prev,
              timeRemaining: 'Ended'
            };
          }
        });
      }
    }, 1000);
    
    // Slower interval for data fetching (3 seconds)
    const dataFetchInterval = setInterval(() => {
      if (email) {
        // Poll for user debates
        fetch(`http://localhost:5050/api/debates/user/${email}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              const formattedDebates = data.map(debate => {
                const isUser1 = debate.user1.email === email;
                const opponent = isUser1 ? debate.user2 : debate.user1;
                
                let timeRemaining = '';
                if (debate.status === 'active' && debate.endTime) {
                  const endTime = new Date(debate.endTime);
                  const now = new Date();
                  const diffMs = endTime - now;
                  if (diffMs > 0) {
                    // Just display seconds for testing
                    const diffSecs = Math.floor(diffMs / 1000);
                    timeRemaining = `${diffSecs}s`;
                    
                    // Auto-complete soon-to-expire debates
                    if (diffMs < 1000 && diffMs > 0) {
                      setTimeout(async () => {
                        try {
                          await fetch(`http://localhost:5050/api/debates/${debate._id}/complete`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                          });
                        } catch (error) {
                          console.error('Error completing debate:', error);
                        }
                      }, diffMs + 1000);
                    }
                  } else {
                    timeRemaining = 'Ended';
                    
                    // Auto-complete if needed
                    if (debate.status === 'active') {
                      fetch(`http://localhost:5050/api/debates/${debate._id}/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                      }).catch(error => {
                        console.error('Error completing debate:', error);
                      });
                    }
                  }
                }

                // Get existing debate from state to preserve expanded status
                const existingDebate = myDebates.find(d => d.id === debate._id);
                
                // Calculate result status more robustly for completed debates
                let result = null;
                if (debate.status === 'completed') {
                  if (debate.votes.user1 === debate.votes.user2) {
                    result = 'tie';
                  } else {
                    const user1Won = debate.votes.user1 > debate.votes.user2;
                    const isCurrentUserWinner = (isUser1 && user1Won) || (!isUser1 && !user1Won);
                    result = isCurrentUserWinner ? 'won' : 'lost';
                  }
                }

                return {
                  id: debate._id,
                  topic: debate.topic || 'Waiting for match...',
                  opponent: opponent ? {
                    id: opponent._id,
                    name: opponent.name,
                    ideology: opponent.onboarding?.inferredIdeology || 'Unknown',
                    totalWins: opponent.totalWins || 0
                  } : null,
                  status: debate.status === 'waiting' ? 'Matchmaking' : debate.status === 'active' ? 'Active' : 'Completed',
                  timeRemaining,
                  messages: debate.messages,
                  startTime: debate.startTime,
                  endTime: debate.endTime,
                  // Critical: preserve expanded state from previous state AND result property
                  expanded: existingDebate ? existingDebate.expanded : false,
                  result: result, // Ensure we always have the result property set correctly
                  votes: debate.votes,
                  votingEnded: debate.votingEnded
                };
              });
              
              // Update myDebates while preserving expanded states
              setMyDebates(prevDebates => {
                return formattedDebates
                  .filter(d => !dismissedDebates.includes(d.id))
                  .map(newDebate => {
                    // Check if this debate existed in previous state and preserve its expanded status
                    const prevDebate = prevDebates.find(d => d.id === newDebate.id);
                    if (prevDebate) {
                      return {
                        ...newDebate,
                        expanded: prevDebate.expanded,
                        result: newDebate.result || prevDebate.result // Keep existing result if new one isn't set
                      };
                    }
                    return newDebate;
                  });
              });
              
              // If we have an active debate open, update its messages
              if (activeDebate) {
                const updatedActiveDebate = formattedDebates.find(d => d.id === activeDebate.id);
                if (updatedActiveDebate) {
                  // Update active debate while preserving UI state
                  setActiveDebate(prev => ({
                    ...updatedActiveDebate,
                    expanded: prev.expanded
                  }));
                }
              }
              
              // Check for newly completed debates to add to featured
              const newlyCompletedDebates = formattedDebates.filter(
                debate => debate.status === 'Completed' && 
                !featuredDebates.some(fd => fd.id === debate.id)
              );
              
              if (newlyCompletedDebates.length > 0) {
                // Refresh featured debates list to include new ones
                fetch('http://localhost:5050/api/debates')
                  .then(res => res.ok ? res.json() : null)
                  .then(debatesData => {
                    if (debatesData) {
                      const completedDebates = debatesData
                        .filter(debate => debate.status === 'completed')
                        .map(debate => {
                          // Find existing featured debate to preserve its expanded state
                          const existingFeaturedDebate = featuredDebates.find(fd => fd.id === debate._id);
                          
                          return {
                            id: debate._id,
                            topic: debate.topic,
                            user1: { 
                              name: debate.user1.name,
                              id: debate.user1._id,
                              ideology: debate.user1.onboarding?.inferredIdeology || 'Unknown',
                              totalWins: debate.user1.totalWins || 0
                            },
                            user2: { 
                              name: debate.user2.name,
                              id: debate.user2._id,
                              ideology: debate.user2.onboarding?.inferredIdeology || 'Unknown',
                              totalWins: debate.user2.totalWins || 0
                            },
                            snippet: debate.messages.slice(0, 2).map(m => m.content).join(' ... '),
                            votes: debate.votes,
                            // Critical: preserve expanded state
                            expanded: existingFeaturedDebate ? existingFeaturedDebate.expanded : false,
                            messages: debate.messages,
                            votingEnded: debate.votingEnded || false,
                            endTime: debate.endTime
                          };
                        });
                      
                      // Update while preserving expanded state
                      setFeaturedDebates(prevDebates => {
                        return completedDebates.map(newDebate => {
                          const prevDebate = prevDebates.find(d => d.id === newDebate.id);
                          if (prevDebate) {
                            return {
                              ...newDebate,
                              expanded: prevDebate.expanded
                            };
                          }
                          return newDebate;
                        });
                      });
                    }
                  })
                  .catch(error => console.error('Error fetching featured debates:', error));
              } else {
                // Just update votes and other dynamic data while preserving expanded state
                fetch('http://localhost:5050/api/debates')
                  .then(res => res.ok ? res.json() : null)
                  .then(debatesData => {
                    if (debatesData) {
                      setFeaturedDebates(prevDebates => {
                        return prevDebates.map(featuredDebate => {
                          const matchingDebate = debatesData.find(d => d._id === featuredDebate.id);
                          if (matchingDebate) {
                            return {
                              ...featuredDebate,
                              votes: matchingDebate.votes,
                              votingEnded: matchingDebate.votingEnded || false,
                              // Preserve expanded state
                              expanded: featuredDebate.expanded
                            };
                          }
                          return featuredDebate;
                        });
                      });
                    }
                  })
                  .catch(error => console.error('Error updating featured debates:', error));
              }
            }
          })
          .catch(err => console.error('Error polling debates:', err));
          
        // Also refresh user data to get updated win count
        fetch(`http://localhost:5050/api/users`)
          .then(res => res.ok ? res.json() : null)
          .then(users => {
            if (users) {
              const currentUser = users.find(user => user.email === email);
              if (currentUser) {
                // Only update if win count changed
                if (currentUser.totalWins !== userInfo.totalWins) {
                  console.log(`Win count updated: ${userInfo.totalWins} → ${currentUser.totalWins}`);
                  setUserInfo(prev => ({
                    ...prev,
                    totalWins: currentUser.totalWins || 0
                  }));
                }
              }
            }
          })
          .catch(error => console.error('Error fetching user data:', error));
      }
    }, 1000);

    return () => {
      clearInterval(dataFetchInterval);
      clearInterval(timerUpdateInterval);
    };
  }, [email, navigate, dismissedDebates, userInfo.totalWins]); // Added userInfo.totalWins
  
  // Add dedicated effect for activeDebate polling:
  useEffect(() => {
    if (!activeDebate) return;
    const intervalId = setInterval(() => {
      fetch(`http://localhost:5050/api/debates/user/${email}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!data) return;
          const match = data.find(d => d._id === activeDebate.id);
          if (!match) return;
          
          // recalc timer
          const now = new Date(), end = new Date(match.endTime);
          const diffMs = end - now;
          const timeRemaining = diffMs > 0 ? `${Math.floor(diffMs/1000)}s` : 'Ended';
          
          const isUser1 = match.user1.email === email;
          const serverMessages = match.messages.map(msg => ({
            ...msg,
            isCurrentUser: isUser1 ? msg.userId === match.user1._id : msg.userId === match.user2._id
          }));
          
          // Only add pending messages that aren't already in the server response
          const pendingMessages = (activeDebate.messages || [])
            .filter(msg => msg.userId === 'pending')
            .filter(pendingMsg => {
              // Keep pending message only if it's not found in server messages
              return !serverMessages.some(serverMsg => 
                serverMsg.content === pendingMsg.content && 
                new Date(serverMsg.timestamp).getTime() > new Date().getTime() - 5000
              );
            })
            .map(msg => ({
              ...msg,
              isCurrentUser: true // Pending messages are always from current user
            }));
          
          // Combine server and pending messages
          const mergedMessages = [...serverMessages, ...pendingMessages]
            // Sort by timestamp to ensure chronological order
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          setActiveDebate(prev => ({
            ...prev,
            timeRemaining,
            messages: mergedMessages
          }));
        })
        .catch(console.error);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [activeDebate, email]);

  // Save voted debates to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('votedDebates', JSON.stringify(votedDebates));
  }, [votedDebates]);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (activeDebate) {
      scrollToBottom();
    }
  }, [activeDebate?.messages]);

  const toggleDebateExpansion = (id) => {
    setFeaturedDebates(featuredDebates.map(debate => 
      debate.id === id ? { ...debate, expanded: !debate.expanded } : debate
    ));
  };
  
  const toggleMyDebateExpansion = (id) => {
    setMyDebates(myDebates.map(debate => 
      debate.id === id ? { ...debate, expanded: !debate.expanded } : debate
    ));
  };

  const handleVote = async (debateId, votedFor) => {
    try {
      // Check if user has already voted for this debate
      const alreadyVotedIndex = votedDebates.findIndex(vote => vote.debateId === debateId);
      const alreadyVoted = alreadyVotedIndex !== -1;
      
      // If already voted for the same user, do nothing
      if (alreadyVoted && votedDebates[alreadyVotedIndex].votedFor === votedFor) {
        return;
      }
      
      // Clone current state for featured debates
      let updatedFeaturedDebates = [...featuredDebates];
      
      // Find the debate being voted on
      const debateIndex = updatedFeaturedDebates.findIndex(debate => debate.id === debateId);
      if (debateIndex === -1) return;
      
      const debate = updatedFeaturedDebates[debateIndex];
      const newVotes = { ...debate.votes };
      
      // If switching vote, decrement previous vote
      if (alreadyVoted) {
        const previousVote = votedDebates[alreadyVotedIndex].votedFor;
        newVotes[previousVote] -= 1; // Remove previous vote
      }
      
      // Add new vote
      newVotes[votedFor] += 1;
      
      // Update the debate with new votes and user's choice
      updatedFeaturedDebates[debateIndex] = { 
        ...debate, 
        votes: newVotes,
        userVoted: votedFor 
      };
      
      // Update state optimistically
      setFeaturedDebates(updatedFeaturedDebates);
      
      // Update voted debates record
      if (alreadyVoted) {
        const newVotedDebates = [...votedDebates];
        newVotedDebates[alreadyVotedIndex] = { debateId, votedFor };
        setVotedDebates(newVotedDebates);
      } else {
        setVotedDebates([...votedDebates, { debateId, votedFor }]);
      }
      
      // Make the actual API call
      const response = await fetch(`http://localhost:5050/api/debates/${debateId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, votedFor, isUpdate: alreadyVoted })
      });
      
      if (!response.ok) {
        // If the server rejects the vote, roll back our optimistic update
        throw new Error('Failed to register vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to register your vote. Please try again.');
    }
  };

  const startMatchmaking = async () => {
    setIsMatchmaking(true);
    
    try {
      const response = await fetch('http://localhost:5050/api/debates/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (data.matched) {
        setMatchFound(true);
        
        // Auto dismiss match notification after 3 seconds
        setTimeout(() => {
          setMatchFound(false);
        }, 3000);
        
        // Refresh debates list to show the new matched debate
        const userDebatesResponse = await fetch(`http://localhost:5050/api/debates/user/${email}`);
        if (userDebatesResponse.ok) {
          const debates = await userDebatesResponse.json();
          const formattedDebates = debates.map(debate => {
            const isUser1 = debate.user1.email === email;
            const opponent = isUser1 ? debate.user2 : debate.user1;
            
            let timeRemaining = '';
            if (debate.status === 'active' && debate.endTime) {
              const endTime = new Date(debate.endTime);
              const now = new Date();
              const diffMs = endTime - now;
              if (diffMs > 0) {
                // Just display seconds for testing
                const diffSecs = Math.floor(diffMs / 1000);
                timeRemaining = `${diffSecs}s`;
              } else {
                timeRemaining = 'Ended';
              }
            }
            
            return {
              id: debate._id,
              topic: debate.topic || 'Waiting for match...',
              opponent: opponent ? {
                id: opponent._id,
                name: opponent.name,
                ideology: opponent.onboarding?.inferredIdeology || 'Unknown',
                totalWins: opponent.totalWins || 0
              } : null,
              status: debate.status === 'waiting' ? 'Matchmaking' : debate.status === 'active' ? 'Active' : 'Completed',
              timeRemaining,
              messages: debate.messages,
              startTime: debate.startTime,
              endTime: debate.endTime
            };
          });
          
          setMyDebates(formattedDebates.filter(d => !dismissedDebates.includes(d.id)));
        }
      } else {
        // User has been added to the queue, but no match yet
        alert('You have been added to the matchmaking queue. We\'ll notify you when a match is found!');
      }
    } catch (error) {
      console.error('Matchmaking error:', error);
    } finally {
      setIsMatchmaking(false);
    }
  };

  const viewDebate = (debate) => {
    if (!debate) return;
    
    // Mark each message as from current user or opponent
    const isUser1 = debate.opponent ? true : debate.user1?.email === email;
    const messages = debate.messages?.map(msg => ({
      ...msg,
      isCurrentUser: isUser1 
        ? msg.userId !== debate.opponent?.id 
        : msg.userId === debate.user1?._id
    })) || [];
    
    setActiveDebate({
      ...debate,
      messages
    });
  };

  const sendMessage = async () => {
    if (!debateMessage.trim() || !activeDebate) return;
    
    try {
      const response = await fetch(`http://localhost:5050/api/debates/${activeDebate.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message: debateMessage })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setDebateMessage('');
        
        // Update the active debate with the new message (actual update will come from polling)
        const updatedMessages = [...activeDebate.messages, { 
          userId: 'pending', // Temporary ID until refresh
          content: debateMessage,
          timestamp: new Date(),
          isCurrentUser: true // Always mark pending messages as from current user
        }];
        
        setActiveDebate({
          ...activeDebate,
          messages: updatedMessages
        });
      } else {
        // Handle toxic message response
        if (data.toxicityScores) {
          alert(data.message + '\n\nToxicity Scores:\n' + 
            Object.entries(data.toxicityScores)
              .map(([key, value]) => `${key}: ${Math.round(value * 100)}%`)
              .join('\n'));
        } else {
          alert(data.message || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };
  
  const closeDebate = () => {
    setActiveDebate(null);
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      color: 'white',
      minHeight: '100vh',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <header style={{
        borderBottom: '1px solid #444',
        paddingBottom: '15px',
        marginBottom: '25px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, color: '#4CAF50' }}>Civitas</h1>
        <div>
          {userInfo.ideology && (
            <span style={{
              backgroundColor: userInfo.ideology === 'Liberal' ? '#3b82f6' : 
                              userInfo.ideology === 'Conservative' ? '#ef4444' : '#10b981',
              padding: '5px 10px',
              borderRadius: '15px',
              fontSize: '0.9rem',
              marginRight: '15px'
            }}>
              {userInfo.ideology}
            </span>
          )}
          <button style={{
            backgroundColor: 'transparent',
            border: '1px solid #888',
            color: '#888',
            padding: '5px 10px',
            borderRadius: '5px',
            cursor: 'pointer'
          }} onClick={() => {
            localStorage.removeItem('email');
            navigate('/login');
          }}>
            Logout
          </button>
        </div>
      </header>

      {/* Active Debate Dialog */}
      {activeDebate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Debate Header */}
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #444',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>{activeDebate.topic}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>Opponent:</span> {activeDebate.opponent?.name || 'Waiting for opponent'} 
                    {activeDebate.opponent && (
                      <>
                        <span style={{
                          backgroundColor: activeDebate.opponent.ideology === 'Liberal' ? '#3b82f6' : 
                                          activeDebate.opponent.ideology === 'Conservative' ? '#ef4444' : '#10b981',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          marginLeft: '8px'
                        }}>
                          {activeDebate.opponent.ideology}
                        </span>
                        <span style={{
                          backgroundColor: '#444',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          marginLeft: '8px'
                        }}>
                          {activeDebate.opponent.totalWins} wins
                        </span>
                      </>
                    )}
                  </div>
                  <div style={{
                    backgroundColor: activeDebate.status === 'Active' ? '#3b82f6' : 
                                    activeDebate.status === 'Completed' ? '#ef4444' : '#10b981',
                    padding: '3px 8px',
                    borderRadius: '10px',
                    fontSize: '0.8rem'
                  }}>
                    {activeDebate.status}
                  </div>
                  {activeDebate.timeRemaining && (
                    <div style={{ fontWeight: 'bold' }}>
                      Time Remaining: {activeDebate.timeRemaining}
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={closeDebate}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
            
            {/* Debate Messages */}
            <div style={{
              padding: '15px',
              flexGrow: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxHeight: '60vh'
            }}>
              {activeDebate.messages && activeDebate.messages.length > 0 ? (
                activeDebate.messages.map((msg, i) => (
                  <div key={i} style={{
                    backgroundColor: msg.isCurrentUser ? '#2a332a' : '#252525',
                    padding: '10px',
                    borderRadius: '8px',
                    maxWidth: '80%',
                    alignSelf: msg.isCurrentUser ? 'flex-end' : 'flex-start',
                    opacity: msg.userId === 'pending' ? 0.7 : 1
                  }}>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: '#aaa', 
                      marginBottom: '5px',
                      textAlign: msg.isCurrentUser ? 'right' : 'left'
                    }}>
                      {msg.timestamp ? formatDate(msg.timestamp) : 'Just now'}
                    </div>
                    <div>{msg.content}</div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                  {activeDebate.status === 'Matchmaking' 
                    ? 'Waiting for a match...'
                    : 'Be the first to start the debate!'}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div style={{
              padding: '15px',
              borderTop: '1px solid #444',
              display: 'flex',
              gap: '10px'
            }}>
              <input
                type="text"
                value={debateMessage}
                onChange={(e) => setDebateMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={activeDebate.status !== 'Active'}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#252525',
                  border: '1px solid #444',
                  borderRadius: '5px',
                  color: 'white'
                }}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button
                onClick={sendMessage}
                disabled={activeDebate.status !== 'Active'}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  border: 'none',
                  borderRadius: '5px',
                  color: 'white',
                  cursor: activeDebate.status === 'Active' ? 'pointer' : 'not-allowed',
                  opacity: activeDebate.status === 'Active' ? 1 : 0.6
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '25px' }}>
        {/* Left sidebar - User profile */}
        <div style={{ width: '200px', padding: '15px', backgroundColor: '#252525', borderRadius: '8px', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0, color: '#4CAF50' }}>My Profile</h3>
          <p><strong>Name:</strong> {userInfo.name}</p>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Ideology:</strong> {userInfo.ideology || 'Loading...'}</p>
          <p><strong>Total Wins:</strong> {userInfo.totalWins}</p>
        </div>

        {/* Main content area */}
        <div style={{ flex: 1 }}>
          {/* My Debates Section (Moved to top for better visibility) */}
          <section>
            <h2 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', color: '#4CAF50' }}>
              My Debates
            </h2>
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p>{myDebates.length === 0 ? 'You have no active debates.' : `You have ${myDebates.length} debate(s).`}</p>
              
              <button 
                onClick={startMatchmaking}
                disabled={isMatchmaking}
                style={{
                  backgroundColor: '#4CAF50',
                  border: 'none',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: isMatchmaking ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {isMatchmaking ? 'Finding Match...' : 'Find Debate Match'}
              </button>
            </div>
            
            {matchFound && (
              <div 
                style={{ 
                  backgroundColor: '#333', 
                  padding: '10px 15px', 
                  borderRadius: '5px', 
                  marginTop: '15px',
                  border: '1px solid #4CAF50',
                  animation: 'fadeInOut 3s forwards'
                }}
              >
                <p style={{ margin: 0, color: '#4CAF50', fontWeight: 'bold' }}>
                  New match found! Check your debate list below.
                </p>
              </div>
            )}
            
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {myDebates.map(debate => (
                <div
                  key={debate.id}
                  style={{
                    position: 'relative',
                    padding: (debate.status === 'Completed' && debate.result && debate.votingEnded) ? '30px 15px 15px' : '15px',
                    backgroundColor: debate.status === 'Matchmaking' ? '#2a2a33'
                                    : debate.status === 'Active'      ? '#2a332a'
                                    : '#252525',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    border: debate.status === 'Active' ? '1px solid #4CAF50' :
                            (debate.result === 'won' && debate.votingEnded) ? '1px solid #4CAF50' :
                            (debate.result === 'lost' && debate.votingEnded) ? '1px solid #ef4444' : 'none',
                  }}
                >
                  {debate.status === 'Completed' && (
                    <>
                      <button
                        onClick={() => removeMyDebate(debate.id)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#ccc',
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                          zIndex: 1
                        }}
                      >
                        ×
                      </button>
                      
                      {/* Only show win/loss banner when voting has ended */}
                      {debate.result && debate.votingEnded && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            padding: '5px 10px',
                            backgroundColor: debate.result === 'won' ? 'rgba(76, 175, 80, 0.9)' : 
                                            debate.result === 'lost' ? 'rgba(239, 68, 68, 0.9)' : 
                                                                      'rgba(255, 193, 7, 0.9)',
                            color: 'white',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            borderTopLeftRadius: '8px',
                            borderTopRightRadius: '8px',
                          }}
                        >
                          {debate.result === 'won' ? 'YOU WON!' : 
                          debate.result === 'lost' ? 'YOU LOST' : 'TIED'}
                        </div>
                      )}
                    </>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>{debate.topic}</h3>
                    <div style={{
                      backgroundColor: debate.status === 'Active' ? '#3b82f6'
                                      : debate.status === 'Matchmaking' ? '#10b981'
                                                                      : '#ef4444',
                      padding: '3px 8px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      zIndex: 0
                    }}>
                      {debate.status}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div>
                      <span style={{ fontWeight: 'bold' }}>Opponent:</span> {debate.opponent?.name || 'Waiting for match'} 
                      {debate.opponent && (
                        <>
                          <span style={{
                            backgroundColor: debate.opponent.ideology === 'Liberal' ? '#3b82f6' : 
                                            debate.opponent.ideology === 'Conservative' ? '#ef4444' : '#10b981',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '0.8rem',
                            marginLeft: '8px'
                          }}>
                            {debate.opponent.ideology}
                          </span>
                          <span style={{
                            backgroundColor: '#444',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '0.8rem',
                            marginLeft: '8px'
                          }}>
                            {debate.opponent.totalWins} wins
                          </span>
                        </>
                      )}
                    </div>
                    {debate.timeRemaining && (
                      <div>
                        <span style={{ fontWeight: 'bold' }}>Time Remaining:</span> {debate.timeRemaining}
                      </div>
                    )}
                  </div>
                  
                  {debate.status === 'Completed' && (
                    <>
                      <button
                        onClick={() => toggleMyDebateExpansion(debate.id)}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid #4CAF50',
                          color: '#4CAF50',
                          padding: '5px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          marginBottom: '10px'
                        }}
                      >
                        {debate.expanded ? 'Hide Transcript' : 'Show Transcript'}
                      </button>
                      
                      {debate.expanded && (
                        <div style={{ 
                          maxHeight: '300px', 
                          overflowY: 'auto', 
                          border: '1px solid #444', 
                          padding: '10px', 
                          borderRadius: '5px',
                          marginBottom: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>
                              You
                            </span>
                            <span style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                              {debate.opponent?.name}
                            </span>
                          </div>
                          {debate.messages?.length > 0 ? (
                            debate.messages.map((msg, i) => {
                              // Determine if message is from current user (by checking against opponent ID)
                              const isFromUser = msg.userId !== debate.opponent?.id;
                              
                              return (
                                <div key={i} style={{ 
                                  display: 'flex',
                                  justifyContent: isFromUser ? 'flex-start' : 'flex-end',
                                  marginBottom: '10px'
                                }}>
                                  <div style={{ 
                                    backgroundColor: isFromUser ? '#2a3a4a' : '#3a2a2a',
                                    padding: '8px 12px', 
                                    borderRadius: '8px',
                                    maxWidth: '80%',
                                    textAlign: 'left',
                                    borderLeft: isFromUser ? '3px solid #3b82f6' : 'none',
                                    borderRight: isFromUser ? 'none' : '3px solid #ef4444',
                                  }}>
                                    <div style={{ 
                                      fontSize: '0.8rem', 
                                      color: '#aaa', 
                                      marginBottom: '3px',
                                      textAlign: 'right'
                                    }}>
                                      {formatDate(msg.timestamp)}
                                    </div>
                                    <div>{msg.content}</div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p style={{ textAlign: 'center', color: '#888' }}>No messages in this debate.</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#aaa', fontSize: '0.9rem' }}>
                      {debate.messages?.length > 0 
                        ? `${debate.messages.length} message${debate.messages.length === 1 ? '' : 's'}`
                        : 'No messages yet'}
                    </div>
                    {debate.status !== 'Completed' && (
                      <button 
                        onClick={() => viewDebate(debate)}
                        style={{
                          backgroundColor: '#4CAF50',
                          border: 'none',
                          color: 'white',
                          padding: '8px 15px',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {debate.status === 'Matchmaking' ? 'View Status' : 
                         debate.status === 'Active' ? 'Continue Debate' : 'View Debate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Featured Debates Section */}
          <section style={{ marginTop: '40px' }}>
            <h2 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', color: '#4CAF50' }}>
              Featured Debates
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              {featuredDebates.filter(debate => !debate.votingEnded).length > 0 ? (
                featuredDebates.filter(debate => !debate.votingEnded).map(debate => (
                  <div key={debate.id} style={{
                    backgroundColor: '#252525',
                    borderRadius: '8px',
                    padding: '15px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <h3 style={{ margin: '0', color: '#4CAF50' }}>{debate.topic}</h3>
                      
                      {/* Add countdown timer */}
                      <div style={{
                        backgroundColor: '#333',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        color: '#f0f0f0'
                      }}>
                        {(() => {
                          const endTime = new Date(debate.endTime);
                          const now = new Date();
                          const secondsPassed = (now - endTime) / 1000;
                          const secsRemaining = Math.max(0, Math.floor(60 - secondsPassed));
                          
                          return secondsPassed >= 60 
                            ? 'Expiring now' 
                            : `${secsRemaining} sec${secsRemaining === 1 ? '' : 's'} to vote`;
                        })()}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <span style={{
                          backgroundColor: debate.user1.ideology === 'Liberal' ? '#3b82f6' : 
                                          debate.user1.ideology === 'Conservative' ? '#ef4444' : '#10b981',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.8rem'
                        }}>
                          {debate.user1.ideology}
                        </span>
                        <span style={{ 
                          marginLeft: '5px',
                          fontWeight: debate.votes.user1 > debate.votes.user2 ? 'bold' : 'normal' 
                        }}>
                          {debate.user1.name}
                          {debate.votes.user1 > debate.votes.user2 && 
                            <span style={{ marginLeft: '5px', color: '#ffc107' }}>●</span>}
                        </span>
                        <span style={{
                          backgroundColor: '#444',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          marginLeft: '8px'
                        }}>
                          {debate.user1.totalWins} wins
                        </span>
                      </div>
                      <div style={{ fontWeight: 'bold' }}>VS</div>
                      <div>
                        <span style={{ 
                          marginRight: '5px',
                          fontWeight: debate.votes.user2 > debate.votes.user1 ? 'bold' : 'normal' 
                        }}>
                          {debate.votes.user2 > debate.votes.user1 && 
                            <span style={{ marginRight: '5px', color: '#ffc107' }}>●</span>}
                          {debate.user2.name}
                        </span>
                        <span style={{
                          backgroundColor: debate.user2.ideology === 'Liberal' ? '#3b82f6' : 
                                          debate.user2.ideology === 'Conservative' ? '#ef4444' : '#10b981',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.8rem'
                        }}>
                          {debate.user2.ideology}
                        </span>
                        <span style={{
                          backgroundColor: '#444',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          marginLeft: '8px'
                        }}>
                          {debate.user2.totalWins} wins
                        </span>
                      </div>
                    </div>
                    
                    {/* Add transcript toggle button */}
                    <button
                      onClick={() => toggleDebateExpansion(debate.id)}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid #4CAF50',
                        color: '#4CAF50',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        marginBottom: '10px'
                      }}
                    >
                      {debate.expanded ? 'Hide Transcript' : 'View Transcript'}
                    </button>
                    
                    {debate.expanded ? (
                      <div style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto', 
                        border: '1px solid #444', 
                        padding: '10px', 
                        borderRadius: '5px',
                        marginBottom: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>
                            {debate.user1.name}
                          </span>
                          <span style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                            {debate.user2.name}
                          </span>
                        </div>
                        {debate.messages.length > 0 ? (
                          debate.messages.map((msg, i) => {
                            // Determine if message is from user1 or user2
                            const isUser1 = msg.userId === debate.user1.id;
                            
                            return (
                              <div key={i} style={{ 
                                display: 'flex',
                                justifyContent: isUser1 ? 'flex-start' : 'flex-end',
                                marginBottom: '10px'
                              }}>
                                <div style={{ 
                                  backgroundColor: isUser1 ? '#2a3a4a' : '#3a2a2a',
                                  padding: '8px 12px', 
                                  borderRadius: '8px',
                                  maxWidth: '80%',
                                  textAlign: 'left',
                                  borderLeft: isUser1 ? '3px solid #3b82f6' : 'none',
                                  borderRight: isUser1 ? 'none' : '3px solid #ef4444',
                                }}>
                                  <div style={{ 
                                    fontSize: '0.8rem', 
                                    color: '#aaa', 
                                    marginBottom: '3px',
                                    textAlign: 'right'
                                  }}>
                                    {formatDate(msg.timestamp)}
                                  </div>
                                  <div>{msg.content}</div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p style={{ textAlign: 'center', color: '#888' }}>No messages in this debate.</p>
                        )}
                      </div>
                    ) : (
                      <p>{debate.snippet}</p>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '15px' }}>
                      {(() => {
                        const userVote = votedDebates.find(v => v.debateId === debate.id)?.votedFor;
                        return (
                          <>
                            {userVote && (
                              <div style={{ marginBottom: '8px', color: '#4CAF50', fontWeight: 'bold' }}>
                                You voted for {userVote === 'user1' ? debate.user1.name : debate.user2.name}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <button
                                onClick={() => handleVote(debate.id, 'user1')}
                                disabled={Boolean(userVote)}
                                style={{
                                  backgroundColor: debate.user1.ideology === 'Liberal' ? '#3b82f6'
                                                  : debate.user1.ideology === 'Conservative' ? '#ef4444'
                                                  : '#10b981',
                                  border: 'none',
                                  color: 'white',
                                  padding: '5px 10px',
                                  borderRadius: '5px',
                                  cursor: userVote ? 'not-allowed' : 'pointer',
                                  opacity: userVote ? 0.5 : 1
                                }}
                              >
                                {debate.user1.name} ({debate.votes.user1})
                              </button>
                              <button
                                onClick={() => handleVote(debate.id, 'user2')}
                                disabled={Boolean(userVote)}
                                style={{
                                  backgroundColor: debate.user2.ideology === 'Liberal' ? '#3b82f6'
                                                  : debate.user2.ideology === 'Conservative' ? '#ef4444'
                                                  : '#10b981',
                                  border: 'none',
                                  color: 'white',
                                  padding: '5px 10px',
                                  borderRadius: '5px',
                                  cursor: userVote ? 'not-allowed' : 'pointer',
                                  opacity: userVote ? 0.5 : 1
                                }}
                              >
                                {debate.user2.name} ({debate.votes.user2})
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))
              ) : (
                <p>No featured debates currently available. Complete a debate to see it featured here!</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <style jsx="true">{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}