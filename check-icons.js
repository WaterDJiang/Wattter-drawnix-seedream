
const lucide = require('lucide-react');
const icons = ['Paperclip', 'Send', 'X', 'Image', 'Sparkles', 'ChevronDown', 'BookOpen', 'Plus', 'Trash2', 'Box', 'Eye', 'EyeOff', 'Settings', 'Cpu', 'Info', 'ChevronRight', 'Check', 'Server', 'Shield'];

icons.forEach(icon => {
  if (!lucide[icon]) {
    console.error(`❌ Icon ${icon} is NOT found in lucide-react`);
  } else {
    console.log(`✅ Icon ${icon} found`);
  }
});
