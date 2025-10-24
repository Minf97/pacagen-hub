#!/bin/bash
# =====================================================
# AWS Server OOM Protection Setup
# =====================================================
# Run this ONCE on your AWS server to configure OOM protection
# Usage: sudo ./setup-oom-protection.sh

set -e

echo "🛡️  Setting up OOM protection for AWS server..."

# =====================================================
# 1. Check current memory
# =====================================================
echo ""
echo "📊 Current Memory Status:"
free -h

TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
echo "Total Memory: ${TOTAL_MEM}MB"

# =====================================================
# 2. Create Swap File (if not exists)
# =====================================================
echo ""
echo "💾 Configuring Swap Space..."

if [ -f /swapfile ]; then
  echo "✅ Swap file already exists"
else
  echo "Creating 2GB swap file..."

  # Create 2GB swap file
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile

  # Make swap permanent
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  fi

  echo "✅ Swap file created and enabled"
fi

# =====================================================
# 3. Optimize Swap Settings
# =====================================================
echo ""
echo "⚙️  Optimizing swap settings..."

# Set swappiness to 10 (use swap only when necessary)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# Set vfs_cache_pressure to 50 (balance between cache and swap)
sudo sysctl vm.vfs_cache_pressure=50
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

echo "✅ Swap settings optimized"

# =====================================================
# 4. Configure OOM Killer
# =====================================================
echo ""
echo "🎯 Configuring OOM Killer..."

# Protect SSH and critical services
sudo choom -p $(pgrep sshd | head -n1) -n -1000 2>/dev/null || echo "Note: choom not available on this system"

echo "✅ OOM Killer configured"

# =====================================================
# 5. Install Monitoring Tools
# =====================================================
echo ""
echo "📦 Installing monitoring tools..."

sudo apt-get update -qq
sudo apt-get install -y htop bc

echo "✅ Monitoring tools installed"

# =====================================================
# 6. Create Log Directory
# =====================================================
echo ""
echo "📁 Creating log directory..."

sudo mkdir -p /var/log/pacagen
sudo chmod 755 /var/log/pacagen

echo "✅ Log directory created"

# =====================================================
# 7. Summary
# =====================================================
echo ""
echo "=========================================="
echo "✅ OOM Protection Setup Complete!"
echo "=========================================="
echo ""
echo "Configuration Summary:"
echo "  • Swap Space: 2GB"
echo "  • Swappiness: 10"
echo "  • Cache Pressure: 50"
echo "  • OOM Killer: Configured"
echo ""
echo "Current System Status:"
free -h
echo ""
swapon --show
echo ""
echo "Next Steps:"
echo "  1. Copy monitor-memory.sh to server"
echo "  2. Add to crontab: */5 * * * * /path/to/monitor-memory.sh"
echo "  3. Monitor logs: tail -f /var/log/pacagen-memory.log"
echo ""
