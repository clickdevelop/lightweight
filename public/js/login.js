document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMessageDiv = document.getElementById('errorMessage');

        errorMessageDiv.textContent = ''; // Clear previous errors

        if (!username || !password) {
            errorMessageDiv.textContent = 'Please enter both username and password.';
            return;
        }

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = '/'; // Redirect to home or dashboard
            } else {
                errorMessageDiv.textContent = data.message || 'Login failed. Please try again.';
            }
        } catch (error) {
            console.error('Error during login:', error);
            errorMessageDiv.textContent = 'An unexpected error occurred.';
        }
    });
});
