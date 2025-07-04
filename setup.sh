#!/bin/bash

echo "🚗 Setting up Indian ANPR System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first."
fi

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "⚠️  Redis is not running. Please start Redis first."
fi

echo "📦 Installing backend dependencies..."
cd backend
npm install

echo "🐍 Installing Python dependencies..."
pip3 install -r python/requirements.txt

echo "🤖 Setting up AI models..."
python3 python/setup_models.py

echo "📁 Creating required directories..."
mkdir -p uploads/videos temp logs python/models

echo "⚙️  Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your configuration."
fi

echo "👤 Creating default admin user..."
node -e "
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/anpr')
  .then(async () => {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const admin = new User({
        name: 'Administrator',
        email: 'admin@anpr.com',
        password: 'admin123',
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Default admin user created: admin@anpr.com / admin123');
    } else {
      console.log('✅ Admin user already exists');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"

cd ..

echo "🎨 Installing frontend dependencies..."
cd frontend
npm install

cd ..

echo "🎉 Setup complete!"
echo ""
echo "🚀 To start the application:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Start frontend: cd frontend && npm start"
echo ""
echo "🌐 Access the application at: http://localhost:3000"
echo "👤 Login with: admin@anpr.com / admin123"
echo ""
echo "📚 For Docker deployment: docker-compose up -d"
