#!/bin/bash

echo "📊 ANPR System Monitor"
echo "====================="

while true; do
    clear
    echo "📊 ANPR System Status - $(date)"
    echo "================================"
    
    # Check container status
    echo "🐳 Container Status:"
    docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "💾 Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    
    echo ""
    echo "📈 Service Health:"
    
    # Check frontend
    if curl -s http://localhost:6000 > /dev/null; then
        echo "✅ Frontend (Port 6000): Healthy"
    else
        echo "❌ Frontend (Port 6000): Down"
    fi
    
    # Check backend
    if curl -s http://localhost:6001/api/health > /dev/null; then
        echo "✅ Backend (Port 6001): Healthy"
    else
        echo "❌ Backend (Port 6001): Down"
    fi
    
    # Check MongoDB
    if docker exec anpr-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo "✅ MongoDB: Connected"
    else
        echo "❌ MongoDB: Connection Failed"
    fi
    
    # Check Redis
    if docker exec anpr-redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis: Connected"
    else
        echo "❌ Redis: Connection Failed"
    fi
    
    echo ""
    echo "Press Ctrl+C to exit monitoring..."
    sleep 10
done
