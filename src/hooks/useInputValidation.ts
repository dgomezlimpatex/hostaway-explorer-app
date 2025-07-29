import { useMemo } from 'react';

// Input validation and sanitization utilities
export const useInputValidation = () => {
  
  const sanitizeInput = (input: string, type: 'text' | 'email' | 'phone' | 'name' = 'text'): string => {
    if (!input || typeof input !== 'string') return '';
    
    let sanitized = input.trim();
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>'"]/g, '');
    
    // Type-specific sanitization
    switch (type) {
      case 'email':
        sanitized = sanitized.toLowerCase();
        break;
      case 'phone':
        sanitized = sanitized.replace(/[^\d\+\-\(\)\s]/g, '');
        break;
      case 'name':
        sanitized = sanitized.replace(/[^\p{L}\s\-'\.]/gu, '');
        break;
    }
    
    return sanitized;
  };

  const validateEmail = (email: string): { isValid: boolean; error?: string } => {
    const sanitized = sanitizeInput(email, 'email');
    
    if (!sanitized) {
      return { isValid: false, error: 'Email is required' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
      return { isValid: false, error: 'Invalid email format' };
    }
    
    if (sanitized.length > 254) {
      return { isValid: false, error: 'Email too long' };
    }
    
    return { isValid: true };
  };

  const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
    const sanitized = sanitizeInput(phone, 'phone');
    
    if (!sanitized) {
      return { isValid: false, error: 'Phone number is required' };
    }
    
    // Remove all non-digit characters for length check
    const digitsOnly = sanitized.replace(/\D/g, '');
    
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return { isValid: false, error: 'Phone number must be 10-15 digits' };
    }
    
    return { isValid: true };
  };

  const validateName = (name: string): { isValid: boolean; error?: string } => {
    const sanitized = sanitizeInput(name, 'name');
    
    if (!sanitized) {
      return { isValid: false, error: 'Name is required' };
    }
    
    if (sanitized.length < 2) {
      return { isValid: false, error: 'Name must be at least 2 characters' };
    }
    
    if (sanitized.length > 100) {
      return { isValid: false, error: 'Name too long (max 100 characters)' };
    }
    
    return { isValid: true };
  };

  const validateText = (text: string, minLength = 0, maxLength = 1000): { isValid: boolean; error?: string } => {
    const sanitized = sanitizeInput(text, 'text');
    
    if (minLength > 0 && !sanitized) {
      return { isValid: false, error: 'This field is required' };
    }
    
    if (sanitized.length < minLength) {
      return { isValid: false, error: `Minimum ${minLength} characters required` };
    }
    
    if (sanitized.length > maxLength) {
      return { isValid: false, error: `Maximum ${maxLength} characters allowed` };
    }
    
    return { isValid: true };
  };

  const validateNumeric = (value: string, min?: number, max?: number): { isValid: boolean; error?: string } => {
    const sanitized = value.trim();
    
    if (!sanitized) {
      return { isValid: false, error: 'This field is required' };
    }
    
    const numericValue = parseFloat(sanitized);
    
    if (isNaN(numericValue)) {
      return { isValid: false, error: 'Must be a valid number' };
    }
    
    if (min !== undefined && numericValue < min) {
      return { isValid: false, error: `Minimum value is ${min}` };
    }
    
    if (max !== undefined && numericValue > max) {
      return { isValid: false, error: `Maximum value is ${max}` };
    }
    
    return { isValid: true };
  };

  const validateRequired = (value: any): { isValid: boolean; error?: string } => {
    if (value === null || value === undefined || value === '') {
      return { isValid: false, error: 'This field is required' };
    }
    
    if (typeof value === 'string' && value.trim() === '') {
      return { isValid: false, error: 'This field is required' };
    }
    
    return { isValid: true };
  };

  return useMemo(() => ({
    sanitizeInput,
    validateEmail,
    validatePhone,
    validateName,
    validateText,
    validateNumeric,
    validateRequired,
  }), []);
};