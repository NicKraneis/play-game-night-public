# Game Night

Game Night is an interactive web-based game show platform that allows a host to manage quiz games, buzzer rounds, and timer-based challenges with multiple players.

## Features

- **Room System**: Create and join game rooms with unique codes
- **Buzzer System**: Real-time buzzer functionality for quick-response rounds
- **Timer**: Configurable countdown timer for timed challenges
- **Random Number Generator**: Built-in random number generator for game variations
- **Point System**: Track and manage player points
- **Player Notes**: Allow players to submit written answers
- **Avatar Selection**: Players can choose from 20 different avatars
- **Sound Effects**: Audio feedback for buzzer and timer events

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Modern web browser

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/YourUsername/Gamenight.git
   cd Gamenight
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the server
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:10000`

### Font Setup

This project uses the Monigue font, which requires a separate license. Due to licensing restrictions, this font is not included in the repository.

To use the complete design:
1. Obtain the Monigue font through legal means
2. Place the font file (`Monigue.woff2`) in `public/assets/fonts/`

Alternatively, the project will fall back to a system font.

## How to Play

### As Host
1. Click "Create Room" to start a new game session
2. Share the room code with your players
3. Use the control panel to:
   - Manage the buzzer system
   - Start/reset timers
   - Award points
   - Send messages to players
   - View player answers

### As Player
1. Enter the room code provided by the host
2. Choose your avatar and enter your name
3. Use the buzzer when prompted
4. Submit answers in the text field
5. Watch the leaderboard for your score

## Development

### Project Structure
```
Gamenight/
├── public/
│   ├── assets/
│   │   ├── fonts/
│   │   ├── img/
│   │   └── sounds/
│   ├── js/
│   └── styles/
├── server.js
└── package.json
```

### Technologies Used
- Node.js
- Express
- Socket.IO
- HTML5
- CSS3
- JavaScript (vanilla)

## Known Issues

- Browser refresh will disconnect the user from the room
- Sound effects might not work on some mobile browsers
- See [Issues](https://github.com/YourUsername/Gamenight/issues) for more

# Licensing

This project consists of multiple components with different licenses:

## Source Code
The source code is licensed under the CC BY-NC License. [See License](https://creativecommons.org/licenses/by-nc/4.0/deed.en)

## Assets and Resources
- Sounds: Require separate licensing, not included in repository
- Font "Monigue": Require separate licensing, not included in repository
- Images: Require separate licensing, not included in repository

To run this project with all features, you need to:
1. Obtain the following resources separately:
   - Monigue Font
   - Avatar Images
   - Buzzer and timer sound
2. Place them in the appropriate directories as described in the setup guide

Note: Some features may not work without these resources.

## Acknowledgments

- Font "Bricolage Grotesque" from [Google Fonts](https://fonts.google.com/specimen/Bricolage+Grotesque)
- Code structure and improvements developed with assistance from Anthropic's Claude AI

## Support

If you enjoy Game Night, consider supporting its development:
[Support on Patreon](https://www.patreon.com/c/nikra)

## Contact

Nic Kraneis - [GitHub](https://github.com/NicKraneis)

Project Link: [https://github.com/NicKraneis/Gamenight](https://github.com/NicKraneis/Gamenight)
