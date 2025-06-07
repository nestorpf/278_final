import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:5050/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setMessage('Login successful! Redirecting...');

        localStorage.setItem('email', formData.email);

        setTimeout(() => {
          if (result.user.onboardingCompleted) {
            navigate('/home'); // Redirect to home if onboarding is completed
          } else {
            navigate('/onboarding'); // Redirect to onboarding if not completed
          }
        }, 2000);
      } else {
        const errorData = await response.json();
        setMessage(`Login failed: ${errorData.message}`);
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', color: 'white' }}>
      <h2
        style={{
          fontWeight: 'bold',
          padding: '10px',
          border: '2px solid white',
          borderRadius: '5px',
          textAlign: 'center',
          width: '99%', // Looks better than 100% imo
          backgroundColor: 'transparent',
          color: 'white',
        }}
      >
        Login
      </h2>
      <form onSubmit={handleSubmit}>
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
        <button type="submit" style={buttonStyle}>Login</button>
      </form>

      {message && (
        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{message}</p>
      )}

      <p style={{ marginTop: '30px' }}>
        Don’t have an account?
        <br />
        <Link
        to="/signup"
        style={{
            color: '#4CAF50',
            fontWeight: 'bold',
            textDecoration: 'none',
            backgroundColor: 'transparent',
            padding: '4px 8px',
            borderRadius: '4px',
            display: 'inline-block',
        }}
        onMouseEnter={(e) => {
            e.target.style.textDecoration = 'underline';
            e.target.style.backgroundColor = 'transparent'; // ensure no hover background
        }}
        onMouseLeave={(e) => {
            e.target.style.textDecoration = 'none';
            e.target.style.backgroundColor = 'transparent';
        }}
        >
        Create Account
        </Link>
      </p>
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
