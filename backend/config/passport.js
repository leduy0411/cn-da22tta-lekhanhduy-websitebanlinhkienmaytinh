const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
      callbackURL: 'http://localhost:5000/api/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Tìm user đã tồn tại với Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // User đã tồn tại
          return done(null, user);
        }

        // Kiểm tra email đã tồn tại chưa
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Email đã tồn tại, link với Google account
          user.googleId = profile.id;
          user.authProvider = 'google';
          if (!user.avatar || user.avatar.includes('placeholder')) {
            user.avatar = profile.photos[0]?.value || user.avatar;
          }
          await user.save();
          return done(null, user);
        }

        // Tạo user mới
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          avatar: profile.photos[0]?.value || 'https://via.placeholder.com/150',
          authProvider: 'google',
          isActive: true,
          role: 'customer'
        });

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

module.exports = passport;
