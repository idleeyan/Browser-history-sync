// 数据加密/解密工具模块
import CryptoJS from 'crypto-js';

const ENCRYPT_KEY_KEY = 'encryptKey';

/**
 * 获取加密密钥
 * @returns {Promise<string>} 加密密钥
 */
export async function getEncryptKey() {
  const config = await chrome.storage.local.get([ENCRYPT_KEY_KEY]);
  
  if (!config[ENCRYPT_KEY_KEY]) {
    throw new Error('未设置加密密钥，请先在配置页填写');
  }
  
  // 密钥处理：确保长度为16位（AES-128要求），不足补全，超出截断
  return config[ENCRYPT_KEY_KEY].padEnd(16, '0').slice(0, 16);
}

/**
 * 加密数据（JSON对象）
 * @param {Object|Array} data - 要加密的数据
 * @returns {Promise<string>} 加密后的字符串
 */
export async function encryptData(data) {
  const key = await getEncryptKey();
  const jsonData = JSON.stringify(data);
  
  // AES加密，模式：CBC，偏移量：key的前16位
  const iv = CryptoJS.enc.Utf8.parse(key);
  const encrypted = CryptoJS.AES.encrypt(jsonData, CryptoJS.enc.Utf8.parse(key), {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
    iv: iv
  });
  
  return encrypted.toString();
}

/**
 * 解密数据（加密后的字符串）
 * @param {string} encryptedStr - 加密字符串
 * @returns {Promise<Object|Array>} 解密后的数据
 */
export async function decryptData(encryptedStr) {
  const key = await getEncryptKey();
  
  try {
    const iv = CryptoJS.enc.Utf8.parse(key);
    const decrypted = CryptoJS.AES.decrypt(encryptedStr, CryptoJS.enc.Utf8.parse(key), {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
      iv: iv
    });
    
    const jsonData = decrypted.toString(CryptoJS.enc.Utf8);
    if (!jsonData) {
      throw new Error('解密失败：数据为空或密钥错误');
    }
    
    return JSON.parse(jsonData);
  } catch (error) {
    throw new Error(`解密失败：${error.message}`);
  }
}

/**
 * 检查是否已设置加密密钥
 * @returns {Promise<boolean>}
 */
export async function hasEncryptKey() {
  const config = await chrome.storage.local.get([ENCRYPT_KEY_KEY]);
  return !!config[ENCRYPT_KEY_KEY];
}
