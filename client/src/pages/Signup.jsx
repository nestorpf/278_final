import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Signup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5050/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (response.ok) {
        setMessage('Signup successful! Redirecting...');
        setFormData({ name: '', email: '', password: '', confirmPassword: '' });
        localStorage.setItem('email', formData.email);

        setTimeout(() => {
          navigate('/onboarding');
        }, 2000);
      } else {
        const errorData = await response.json();
        setMessage(`Signup failed: ${errorData.message}`);
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '400px',
        margin: '0 auto',
        color: 'white',
      }}
    >
      <h2
        style={{
          fontWeight: 'bold',
          padding: '10px',
          border: '2px solid white',
          borderRadius: '5px',
          width: '99%',  // Better than 100%
          textAlign: 'center',
          backgroundColor: 'transparent',
          color: 'white',
        }}
      >
        Create an Account
      </h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>Re-enter Password:</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <button type="submit" style={buttonStyle}>
          Signup
        </button>
      </form>
      {message && (
        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{message}</p>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px',
  marginTop: '5px',
  backgroundColor: 'transparent',
  color: 'white',
  border: '1px solid white',
  borderRadius: '5px',
};

const buttonStyle = {
  padding: '10px 20px',
  backgroundColor: '#4CAF50',
  color: 'white',
  border: '1px solid white',
  borderRadius: '5px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'inline-block',
  textAlign: 'center',
};

export default Signup;
