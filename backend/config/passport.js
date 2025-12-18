const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
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
      callbackURL: '/api/auth/google/callback',
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

// Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID || 'your-facebook-app-id',
      clientSecret: process.env.FACEBOOK_APP_SECRET || 'your-facebook-app-secret',
      callbackURL: '/api/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Tìm user đã tồn tại với Facebook ID
        let user = await User.findOne({ facebookId: profile.id });

        if (user) {
          // User đã tồn tại
          return done(null, user);
        }

        // Kiểm tra email đã tồn tại chưa (nếu Facebook cung cấp email)
        if (profile.emails && profile.emails.length > 0) {
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Email đã tồn tại, link với Facebook account
            user.facebookId = profile.id;
            user.authProvider = 'facebook';
            if (!user.avatar || user.avatar.includes('placeholder')) {
              user.avatar = profile.photos[0]?.value || user.avatar;
            }
            await user.save();
            return done(null, user);
          }
        }

        // Tạo user mới
        user = await User.create({
          facebookId: profile.id,
          email: profile.emails?.[0]?.value || `facebook_${profile.id}@placeholder.com`,
          name: profile.displayName,
          avatar: profile.photos[0]?.value || 'https://via.placeholder.com/150',
          authProvider: 'facebook',
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
