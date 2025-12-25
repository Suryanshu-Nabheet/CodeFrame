# CodeFrame - AI-Powered Code Generation IDE

**An AI coding platform that generates complete, working applications instantly.**

![CodeFrame](./public/CodeFrame.png)

## 🚀 Features

### **AI-Powered Code Generation**

- God-level AI that creates complete, production-ready projects
- Intelligent planning with real-time progress tracking
- Automatic dependency installation and dev server startup
- Support for Next.js, React, TypeScript, and more

### **Integrated Development Environment**

- Monaco Editor with syntax highlighting
- File tree with real-time updates
- WebContainer-powered terminal
- Live preview with hot reload

### **Enterprise Architecture**

- Production-grade logging and metrics
- Retry mechanisms with circuit breakers
- Comprehensive error handling
- Type-safe with 100% TypeScript coverage

### **Smart UI/UX**

- Dynamic loading states based on request complexity
- Real-time code application to IDE
- Black theme with smooth animations
- Fully responsive design

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI:** OpenRouter API
- **Runtime:** WebContainer API
- **Editor:** Monaco Editor
- **Terminal:** XTerm.js

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/Suryanshu-Nabheet/CodeFrame.git
cd CodeFrame

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Add your OPENROUTER_API_KEY

# Run development server
pnpm dev
```

## 🌐 Environment Variables

Create a `.env` file with:

```env
# Required
OPENROUTER_API_KEY=your_api_key_here

# Optional
NEXT_PUBLIC_LOG_LEVEL=INFO
NEXT_PUBLIC_LOG_ENDPOINT=your_logging_endpoint
NEXT_PUBLIC_METRICS_ENDPOINT=your_metrics_endpoint
```

## 🎯 Usage

1. **Start the application:**

   ```bash
   pnpm dev
   ```

2. **Open your browser:**

   ```
   http://localhost:3000
   ```

3. **Generate code:**

   - Type: "Build a todo app with Next.js"
   - Watch AI create files in real-time
   - See dependencies install automatically
   - Preview your working app instantly

4. **Ask questions:**
   - Type: "What is React?"
   - Get instant, helpful answers

## 🏗️ Project Structure

```
CodeFrame/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   └── ...
├── components/            # React components
│   ├── ai-elements/      # AI UI components
│   ├── chat/             # Chat interface
│   ├── workspace/        # IDE components
│   └── ui/               # Reusable UI components
├── core/                  # Core services
│   ├── services/         # Business logic
│   ├── hooks/            # React hooks
│   ├── types/            # TypeScript types
│   └── utils/            # Utilities
├── lib/                   # Libraries and utilities
└── public/               # Static assets
```

## 🎨 Key Components

### **AI Service**

- Parses AI responses
- Extracts code blocks and commands
- Applies code to file system
- Executes terminal commands

### **WebContainer Service**

- Manages WebContainer instance
- Handles file operations
- Executes commands in isolated environment
- Provides live preview

### **File System Service**

- CRUD operations for files
- Directory management
- Real-time synchronization
- Search functionality

### **Logger & Metrics**

- Structured logging with multiple levels
- Performance tracking
- Error monitoring
- Remote logging support

## 🚀 Deployment

### **Vercel (Recommended)**

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel --prod
```

### **Environment Variables**

Make sure to add all required environment variables in your deployment platform.

## 🧪 Testing

```bash
# Type check
pnpm tsc --noEmit

# Build
pnpm build

# Start production server
pnpm start
```

## 📊 Performance

- **Build Time:** ~4.5s
- **TypeScript:** 0 errors
- **Bundle Size:** Optimized
- **Lighthouse Score:** 90+

## 🔒 Security

- Input validation with Zod
- Error sanitization
- Timeout protection
- Type-safe API routes

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Suryanshu Nabheet**

## 🙏 Acknowledgments

- Built with Next.js and React
- Powered by WebContainer API
- AI by OpenRouter
- UI components inspired by shadcn/ui

---

**Made with ❤️ by Suryanshu Nabheet**

**Status:** ✅ Production Ready | **Version:** 1.0.0
