#!/bin/bash

echo "🚗 Quick Start - Indian ANPR System"
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "🧹 Cleaning up any existing containers..."
docker-compose down -v

echo "🏗️  Building and starting all services..."
docker-compose up -d --build

echo "⏳ Waiting for services to be ready..."
sleep 30

echo "🔍 Checking service health..."
docker-compose ps

echo ""
echo "🎉 ANPR System is now running!"
echo ""
echo "📱 Access Points:"
echo "   Frontend: http://localhost:6000"
echo "   Backend API: http://localhost:6001"
echo "   Full System: http://localhost (via Nginx)"
echo ""
echo "👤 Default Login:"
echo "   Email: admin@anpr.com"
echo "   Password: admin123"
echo ""
echo "📊 Service Status:"
echo "   MongoDB: localhost:27017"
echo "   Redis: localhost:6379"
echo "   Backend: localhost:6001"
echo "   Frontend: localhost:6000"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop system: docker-compose down"
echo "   Restart: docker-compose restart"
echo "   Clean restart: docker-compose down -v && docker-compose up -d"
