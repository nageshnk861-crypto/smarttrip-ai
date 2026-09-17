# SmartTrip App

Welcome to the SmartTrip App! This application is designed to help users plan their trips efficiently by integrating various APIs for maps, AI, weather, hotels, routing, and payments. Below are the details on how to set up and use the application.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Setup Instructions](#setup-instructions)
- [Usage](#usage)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- Trip planning with personalized recommendations
- Integration with AI for travel suggestions
- Real-time weather updates
- Hotel search and booking capabilities
- Interactive maps for navigation
- Payment processing for bookings
- User authentication and profile management
- Progressive Web App (PWA) support for offline access

## Technologies Used

- **Next.js**: A React framework for server-side rendering and static site generation.
- **React**: A JavaScript library for building user interfaces.
- **Tailwind CSS**: A utility-first CSS framework for styling.
- **PostgreSQL**: A powerful, open-source relational database.
- **Supabase**: An open-source Firebase alternative for authentication and database management.
- **Various APIs**: Integration with OpenAI, Google Maps, WeatherAPI, Stripe, etc.

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/smarttrip-app.git
   cd smarttrip-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   - Copy the `.env.example` to `.env` and fill in the required values.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to `http://localhost:3000` to view the application.

## Usage

- **Login**: Navigate to the login page to authenticate your account.
- **Dashboard**: Access your personalized dashboard to view trip options.
- **Trip Planner**: Use the planner to create and manage your trips.
- **Payments**: Complete transactions securely through the payment interface.

## Deployment

This application is designed to be deployed on Vercel. To deploy:

1. Push your code to a GitHub repository.
2. Sign in to [Vercel](https://vercel.com).
3. Import your GitHub repository and follow the prompts to deploy.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.