const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes, Model } = require('sequelize');

// ============ CONFIG ============
const config = {
  PORT: parseInt(process.env.PORT || '5000'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_HOST: process.env.DB_HOST || 'mysql.hawkhost.com',
  DB_PORT: parseInt(process.env.DB_PORT || '3306'),
  DB_USER: process.env.DB_USER || 'novaaipl_puzzlekit',
  DB_PASSWORD: process.env.DB_PASSWORD || 'LEga1993@@',
  DB_NAME: process.env.DB_NAME || 'novaaipl_puzzlekit',
  JWT_SECRET: process.env.JWT_SECRET || 'puzzlekit-production-secret-key-2024-super-secure',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://puzzlekit.leosterling.net',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://puzzlekit.leosterling.net',
    'https://puzzlekit-backend.vercel.app'
  ],
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  API_PREFIX: process.env.API_PREFIX || '/api/v1'
};

// ============ DATABASE ============
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  logging: config.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// ============ USER MODEL ============
class User extends Model {
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  resetMonthlyUsage() {
    const now = new Date();
    const lastReset = new Date(this.usageLastReset);
    
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      this.puzzlesGenerated = 0;
      this.booksCreated = 0;
      this.usageLastReset = now;
    }
  }

  toJSON() {
    const values = super.toJSON();
    const { password, ...rest } = values;
    return rest;
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  subscriptionType: {
    type: DataTypes.ENUM('free', 'premium', 'pro'),
    defaultValue: 'free'
  },
  puzzlesGenerated: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  booksCreated: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  usageLastReset: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, config.BCRYPT_ROUNDS);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, config.BCRYPT_ROUNDS);
      }
    }
  }
});

// ============ PUZZLE MODEL ============
class Puzzle extends Model {}

Puzzle.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  frontendId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('sudoku', 'wordsearch', 'maze', 'nonogram'),
    allowNull: false
  },
  puzzleSvg: {
    type: DataTypes.TEXT('long'),
    allowNull: false
  },
  solutionSvg: {
    type: DataTypes.TEXT('long'),
    allowNull: false
  },
  metaDifficulty: {
    type: DataTypes.ENUM('Easy', 'Medium', 'Hard'),
    allowNull: true
  },
  tags: {
    type: DataTypes.TEXT,
    defaultValue: '[]'
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  sequelize,
  modelName: 'Puzzle',
  tableName: 'puzzles'
});

// ============ BOOK MODEL ============
class Book extends Model {}

Book.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft'
  }
}, {
  sequelize,
  modelName: 'Book',
  tableName: 'books'
});

// ============ ASSOCIATIONS ============
User.hasMany(Puzzle, { foreignKey: 'userId' });
Puzzle.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Book, { foreignKey: 'userId' });
Book.belongsTo(User, { foreignKey: 'userId' });

// ============ MIDDLEWARE ============
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// ============ RATE LIMITING ============
const clients = new Map();

const createSimpleRateLimit = (windowMs, max) => {
  return (req, res, next) => {
    const clientId = req.ip || 'anonymous';
    const now = Date.now();
    
    for (const [key, value] of clients.entries()) {
      if (now > value.resetTime) {
        clients.delete(key);
      }
    }
    
    const client = clients.get(clientId);
    
    if (!client || now > client.resetTime) {
      clients.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }
    
    if (client.count >= max) {
      const resetIn = Math.ceil((client.resetTime - now) / 1000);
      res.set('Retry-After', String(resetIn));
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later'
      });
      return;
    }
    
    client.count++;
    next();
  };
};

const rateLimitMiddleware = createSimpleRateLimit(15 * 60 * 1000, 100);
const authRateLimitMiddleware = createSimpleRateLimit(15 * 60 * 1000, 5);

// ============ CONTROLLERS ============
const generateTokens = (userId) => {
  const token = jwt.sign({ userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN
  });
  return { token, refreshToken: token };
};

// Auth Controllers
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    const user = await User.create({ name, email, password });
    const { token, refreshToken } = generateTokens(String(user.id));

    res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        token,
        refreshToken
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    user.resetMonthlyUsage();
    await user.save();

    const { token, refreshToken } = generateTokens(String(user.id));

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        token,
        refreshToken
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.toJSON(),
      message: 'Profile retrieved successfully'
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============ EXPRESS APP ============
const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression
app.use(compression());

// Logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimitMiddleware);

// ============ ROUTES ============

// Health check
app.get(config.API_PREFIX + '/health', (req, res) => {
  res.json({
    success: true,
    message: 'PuzzleKit API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Auth routes
app.post(config.API_PREFIX + '/auth/register', authRateLimitMiddleware, register);
app.post(config.API_PREFIX + '/auth/login', authRateLimitMiddleware, login);
app.get(config.API_PREFIX + '/auth/profile', authenticateToken, getProfile);

// Basic puzzle routes
app.get(config.API_PREFIX + '/puzzles', authenticateToken, async (req, res) => {
  try {
    const puzzles = await Puzzle.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    
    res.json({
      success: true,
      data: puzzles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post(config.API_PREFIX + '/puzzles', authenticateToken, async (req, res) => {
  try {
    const { type, puzzleSvg, solutionSvg, meta } = req.body;
    
    const puzzle = await Puzzle.create({
      frontendId: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: req.user.id,
      type,
      puzzleSvg,
      solutionSvg,
      metaDifficulty: meta?.difficulty,
      tags: JSON.stringify(meta?.tags || [])
    });

    req.user.puzzlesGenerated += 1;
    await req.user.save();

    res.status(201).json({
      success: true,
      data: puzzle,
      message: 'Puzzle created successfully'
    });
  } catch (error) {
    console.error('Create puzzle error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Basic book routes
app.get(config.API_PREFIX + '/books', authenticateToken, async (req, res) => {
  try {
    const books = await Book.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']],
      limit: 20
    });
    
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post(config.API_PREFIX + '/books', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    
    const book = await Book.create({
      userId: req.user.id,
      title,
      description: description || ''
    });

    req.user.booksCreated += 1;
    await req.user.save();

    res.status(201).json({
      success: true,
      data: book,
      message: 'Book created successfully'
    });
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: config.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message || 'Internal server error'
  });
});

// ============ START SERVER ============
const startServer = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ MySQL connected successfully');

    // Sync models
    if (config.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database synchronized');
    }
    
    // Start listening
    const server = app.listen(config.PORT, () => {
      console.log(`🚀 PuzzleKit API server running on port ${config.PORT}`);
      console.log(`📖 Environment: ${config.NODE_ENV}`);
      console.log(`🔗 API Base URL: http://localhost:${config.PORT}${config.API_PREFIX}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
      server.close(() => {
        console.log('✅ HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
