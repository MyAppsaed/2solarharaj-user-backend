const User = require('../models/auth');
const { AppError } = require('../middlewares/errorHandler');
const { catchAsync } = require('../middlewares/errorHandler');
const { createSendToken } = require('../middlewares/auth');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/mail.util');
// Register user with phone number and email
const registerUser = catchAsync(async (req, res, next) => {
  const { name, phone, email, password, profileImageUrl} = req.body;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{6,}$/;

if (!passwordRegex.test(password)) {
  return next(new AppError(
    'Password must be at least 6 characters long and include uppercase, lowercase, number, and special character.',
    400
  ));
}
  // Check if user already exists with phone or email
  const existingUserByPhone = await User.findOne({ phone });
  const existingUserByEmail = await User.findOne({ email });
  
  if (existingUserByPhone ) {
    return next(new AppError('المستخدم موجود بالفعل بهذا رقم الهاتف. يرجى تسجيل الدخول بدلاً من ذلك.', 409));
  }
  
  if (existingUserByEmail && existingUserByEmail.isVerified) {
    return next(new AppError('المستخدم موجود بالفعل بهذا البريد الإلكتروني. يرجى تسجيل الدخول بدلاً من ذلك.', 409));
  }


 // hash password 

 const hashPassword = await bcrypt.hash(password,8);
  let user;
  const existingUser = existingUserByPhone || existingUserByEmail;
  
  if (existingUser && !existingUser.isVerified) {
    // User exists but not verified, check resend cooldown
    if (!existingUser.canResendOTP()) {
      return next(new AppError('يرجى الانتظار 60 ثانية قبل طلب رمز تحقق جديد.', 429));
    }
    
    user = existingUser;
    // Update user data if different
    user.name = name;
    user.phone = phone;
    user.email = email;
    user.password = hashPassword;
    user.profileImageUrl = profileImageUrl;
    user.generateOTP();
    await user.save();
  } else {
    // Create new user
    user = new User({ phone, email, name, password: hashPassword, profileImageUrl});
    user.generateOTP();
    console.log('🔐 Creating new user:', {
      phone: user.phone,
      email: user.email,
      isActive: user.isActive,
      isVerified: user.isVerified
    });
    await user.save();
  }
  
  // Send OTP via email
  const emailContent = `رمز التحقق الخاص بك هو: ${user.otp}\n\nهذا الرمز صالح لمدة 5 دقائق فقط.\n\nإذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني.`;
  
  try {
    await sendEmail(user.email, emailContent, 'رمز التحقق - Shamsi');
  } catch (emailError) {
    console.error('Failed to send OTP email:', emailError);
    // Continue with registration even if email fails
  }

  res.status(201).json({
    status: 'success',
    message: 'تم التسجيل بنجاح. يرجى التحقق من بريدك الإلكتروني واستخدام رمز التحقق.',
    data: {
      phone: user.phone,
      email: user.email,
      otpExpiresAt: user.otpExpires
    }
  });
});

// Verify OTP and complete registration
const verifyOTP = catchAsync(async (req, res, next) => {
  const {identifier} = req.params; // Can be phone or email
  console.log(identifier);
  const { otp } = req.body;

  // Find user by phone or email
  const user = await User.findOne({ 
    $or: [{ phone: identifier }, { email: identifier }] 
  });
  if (!user) {
    return next(new AppError('لم يتم العثور على مستخدم بهذا الرقم أو البريد الإلكتروني', 404));
  }

  // Verify OTP
  if (!user.verifyOTP(otp)) {
    return next(new AppError('رمز التحقق غير صحيح أو منتهي الصلاحية', 400));
  }

  // Clear OTP and mark as verified
  user.clearOTP();
  user.lastLogin = new Date();
  await user.save();

  // Send token
  createSendToken(user, 200, res);
});

// login - accepts email or phone
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or phone

    // Check if identifier and password are provided
    if (!identifier || !password) {
      return res.status(400).json({
        status: 400,
        data: [],
        message: "يجب إدخال البريد الإلكتروني أو رقم الهاتف وكلمة المرور",
      });
    }

    // Find user by email or phone
    const validUser = await User.findOne({ 
      $or: [{ email: identifier }, { phone: identifier }] 
    });

    console.log('🔐 Login attempt - User lookup:', {
      identifier,
      userFound: !!validUser,
      isActive: validUser?.isActive,
      isVerified: validUser?.isVerified,
      userId: validUser?._id
    });

    if (!validUser) {
      return res.status(404).json({
        status: 404,
        data: [],
        message: "لم يتم العثور على المستخدم",
      });
    }

    // Check if user account is active
    if (!validUser.isActive) {
      return res.status(401).json({
        status: 401,
        data: [],
        message: "حساب المستخدم غير نشط. يرجى التواصل مع الدعم.",
      });
    }

    // Check if user is verified
    if (!validUser.isVerified) {
      return res.status(401).json({
        status: 401,
        data: [],
        message: "يجب تأكيد الحساب أولاً عبر رمز التحقق",
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, validUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 401,
        data: [],
        message: "كلمة مرور غير صحيحة",
      });
    }

    // Generate token after successful phone + password match
    const token = generateToken(validUser);
    
    console.log('🔐 Login successful - Token generated for user:', {
      userId: validUser._id,
      phone: validUser.phone,
      email: validUser.email,
      tokenLength: token.length
    });

    return res.status(200).json({
      status: 200,
      data: { 
        user: {
          id: validUser._id,
          phone: validUser.phone,
          email: validUser.email,
          name: validUser.name,
          profileImageUrl: validUser.profileImageUrl,
          role: validUser.role,
          isVerified: validUser.isVerified,
          createdAt: validUser.createdAt
        },
        token 
      },
      message: "تم تسجيل الدخول بنجاح",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
    });
  }
};


// Request new OTP (for existing users)
const requestOTP = catchAsync(async (req, res, next) => {
  const { identifier } = req.body; // Can be phone or email

  const user = await User.findOne({ 
    $or: [{ phone: identifier }, { email: identifier }] 
  });
  if (!user) {
    return next(new AppError('لم يتم العثور على مستخدم بهذا الرقم أو البريد الإلكتروني. يرجى التسجيل أولاً.', 404));
  }

  // Check resend cooldown
  if (!user.canResendOTP()) {
    return next(new AppError('يرجى الانتظار 60 ثانية قبل طلب رمز تحقق جديد.', 429));
  }

  // Generate new OTP
  user.generateOTP();
  await user.save();
  
  // Send OTP via email
  const emailContent = `رمز التحقق الجديد الخاص بك هو: ${user.otp}\n\nهذا الرمز صالح لمدة 5 دقائق فقط.\n\nإذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني.`;
  
  try {
    await sendEmail(user.email, emailContent, 'رمز التحقق الجديد - Shamsi');
  } catch (emailError) {
    console.error('Failed to send OTP email:', emailError);
    return next(new AppError('فشل في إرسال رمز التحقق. يرجى المحاولة مرة أخرى.', 500));
  }

  res.status(200).json({
    status: 'success',
    message: 'تم إرسال رمز التحقق بنجاح',
    data: {
      phone: user.phone,
      email: user.email,
      otpExpiresAt: user.otpExpires
    }
  });
});

// Update user profile (name and profile image)
const updateProfile = catchAsync(async (req, res, next) => {
  const { name, profileImageUrl } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Update allowed fields only
  if (name !== undefined) user.name = name;
  if (profileImageUrl !== undefined) user.profileImageUrl = profileImageUrl;

  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        isVerified: user.isVerified
      }
    }
  });
});

// Get current user profile
const getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    }
  });
});

// Logout user (invalidate token on client side)
const logout = catchAsync(async (req, res, next) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

// Delete user account
const deleteAccount = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Soft delete - mark as inactive instead of permanent deletion
  user.isActive = false;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Account deleted successfully'
  });
});

// Check if phone number is available
const checkPhone = catchAsync(async (req, res, next) => {
  const { phone } = req.query;

  if (!phone) {
    return next(new AppError('Phone number is required', 400));
  }

  const existingUser = await User.findOne({ phone, isVerified: true });
  
  res.status(200).json({
    status: 'success',
    data: {
      available: !existingUser,
      message: existingUser ? 'Phone number already registered' : 'Phone number available'
    }
  });
});

// Forgot password - request reset OTP
const forgotPassword = catchAsync(async (req, res, next) => {
  const { identifier } = req.body; // Can be phone or email

  const user = await User.findOne({ 
    $or: [{ phone: identifier }, { email: identifier }] 
  });
  if (!user) {
    return next(new AppError('لم يتم العثور على مستخدم بهذا الرقم أو البريد الإلكتروني.', 404));
  }

  if (!user.isVerified) {
    return next(new AppError('يجب تأكيد الحساب أولاً.', 400));
  }

  // Check resend cooldown
  if (!user.canResendOTP()) {
    return next(new AppError('يرجى الانتظار 60 ثانية قبل طلب رمز تحقق جديد.', 429));
  }

  // Generate new OTP for password reset
  user.generateOTP();
  await user.save();
  
  // Send OTP via email
  const emailContent = `رمز إعادة تعيين كلمة المرور الخاص بك هو: ${user.otp}\n\nهذا الرمز صالح لمدة 5 دقائق فقط.\n\nإذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد الإلكتروني.`;
  
  try {
    await sendEmail(user.email, emailContent, 'إعادة تعيين كلمة المرور - Shamsi');
  } catch (emailError) {
    console.error('Failed to send reset password email:', emailError);
    return next(new AppError('فشل في إرسال رمز إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.', 500));
  }

  res.status(200).json({
    status: 'success',
    message: 'تم إرسال رمز إعادة تعيين كلمة المرور بنجاح',
    data: {
      phone: user.phone,
      email: user.email,
      otpExpiresAt: user.otpExpires
    }
  });
});

// Verify forgot password OTP
const verifyForgotPasswordOTP = catchAsync(async (req, res, next) => {
  const {identifier} = req.params; // Can be phone or email
  const { otp } = req.body;
  console.log(identifier, otp);

  // Find user by phone or email
  const user = await User.findOne({ 
    $or: [{ phone: identifier }, { email: identifier }] 
  });
  if (!user) {
    return next(new AppError('لم يتم العثور على مستخدم بهذا الرقم أو البريد الإلكتروني', 404));
  }

  // Verify OTP
  if (!user.verifyOTP(otp)) {
    return next(new AppError('رمز التحقق غير صحيح أو منتهي الصلاحية', 400));
  }

  // Don't clear OTP yet - keep it for password reset verification
  res.status(200).json({
    status: 'success',
    message: 'تم التحقق من الرمز بنجاح. يمكنك الآن إعادة تعيين كلمة المرور.',
    data: {
      identifier: user.email || user.phone,
      resetToken: user.otp // Send OTP as reset token for next step
    }
  });
});

// Reset password with OTP
const resetPassword = catchAsync(async (req, res, next) => {
  const { identifier, otp, newPassword } = req.body;

  // Password validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{6,}$/;
  if (!passwordRegex.test(newPassword)) {
    return next(new AppError(
      'كلمة المرور يجب أن تكون 6 أحرف على الأقل وتحتوي على أحرف كبيرة وصغيرة ورقم ورمز خاص.',
      400
    ));
  }

  // Find user by phone or email
  const user = await User.findOne({ 
    $or: [{ phone: identifier }, { email: identifier }] 
  });
  if (!user) {
    return next(new AppError('لم يتم العثور على مستخدم بهذا الرقم أو البريد الإلكتروني', 404));
  }

  // Verify OTP one more time
  if (!user.verifyOTP(otp)) {
    return next(new AppError('رمز التحقق غير صحيح أو منتهي الصلاحية', 400));
  }

  // Hash new password
  const hashPassword = await bcrypt.hash(newPassword, 8);
  
  // Update password and clear OTP
  user.password = hashPassword;
  user.clearOTP();
  user.lastLogin = new Date();
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
  });
});

module.exports = {
  registerUser,
  verifyOTP,
  requestOTP,
  updateProfile,
  getProfile,
  logout,
  deleteAccount,
  checkPhone,
  login,
  forgotPassword,
  verifyForgotPasswordOTP,
  resetPassword
};
