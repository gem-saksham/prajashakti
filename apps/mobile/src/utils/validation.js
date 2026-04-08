export const validators = {
  phone: (phone) => {
    if (!phone) return 'Phone number is required';
    if (phone.length !== 10) return 'Phone must be 10 digits';
    if (!/^[6-9]\d{9}$/.test(phone)) return 'Invalid Indian phone number';
    return null;
  },
  name: (name) => {
    if (!name || name.trim().length < 2) return 'Name must be at least 2 characters';
    if (name.length > 100) return 'Name is too long';
    return null;
  },
  otp: (otp) => {
    if (!otp) return 'OTP is required';
    if (otp.length !== 6) return 'Enter all 6 digits';
    if (!/^\d{6}$/.test(otp)) return 'OTP must be numeric';
    return null;
  },
};
