#!/usr/bin/env node

/**
 * Translation Coverage Validation Script
 * 
 * This script validates translation coverage across all components by:
 * 1. Scanning all TSX/TypeScript files for translation key usage
 * 2. Comparing against available translations in JSON files
 * 3. Reporting missing translations and unused keys
 * 4. Providing coverage statistics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const LOCALES_DIR = path.join(__dirname, '../public/i18n/locales');
const SUPPORTED_LOCALES = ['ko', 'en'];

// Regex patterns to find translation key usage
const TRANSLATION_PATTERNS = [
  /t\(['"`]([^'"`]+)['"`]\)/g,           // t('key')
  /t\(['"`]([^'"`]+)['"`],/g,            // t('key', variables)
  /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g,     // t( 'key'
];

/**
 * Recursively find all TypeScript/TSX files (excluding tests)
 */
function findSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && !entry.includes('__tests__')) {
      findSourceFiles(fullPath, files);
    } else if (entry.match(/\.(tsx?|jsx?)$/) && !entry.includes('.test.') && !entry.includes('.spec.')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Extract translation keys from source code
 */
function extractTranslationKeys(content) {
  const keys = new Set();
  
  for (const pattern of TRANSLATION_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const key = match[1];
      // Filter out invalid keys and non-translatable content
      if (key && 
          key.length > 1 && 
          key.length < 100 && 
          !key.includes('\n') && 
          !key.includes('should ') && // Exclude test descriptions
          !key.match(/^[|\\]+$/) && // Exclude special characters
          !key.startsWith('/') && // Exclude API endpoints
          !key.includes('${') && // Exclude template literals
          !key.includes('URL:') && // Exclude URL labels
          !key.includes('PIN:') && // Exclude PIN labels
          !key.match(/^(save|cancel|error_occurred|this_key_does_not_exist|welcome_message|enter_customer_title)$/) && // Exclude common false positives
          key !== 'T' && // Exclude single letters
          key !== '\\n' && // Exclude escape sequences
          !key.startsWith('localeChanged')) { // Exclude event names
        keys.add(key);
      }
    }
  }
  
  return Array.from(keys);
}

/**
 * Load translation files
 */
function loadTranslations() {
  const translations = {};
  
  for (const locale of SUPPORTED_LOCALES) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      translations[locale] = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load translations for ${locale}:`, error.message);
      translations[locale] = {};
    }
  }
  
  return translations;
}

/**
 * Validate translation coverage
 */
function validateCoverage() {
  console.log('🔍 Scanning source files for translation keys...\n');
  
  // Find all source files
  const sourceFiles = findSourceFiles(SRC_DIR);
  console.log(`Found ${sourceFiles.length} source files`);
  
  // Extract all used translation keys
  const usedKeys = new Set();
  const keysByFile = new Map();
  
  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const keys = extractTranslationKeys(content);
      
      if (keys.length > 0) {
        const relativePath = path.relative(SRC_DIR, file);
        keysByFile.set(relativePath, keys);
        keys.forEach(key => usedKeys.add(key));
      }
    } catch (error) {
      console.error(`Failed to read ${file}:`, error.message);
    }
  }
  
  console.log(`Found ${usedKeys.size} unique translation keys in use\n`);
  
  // Load translations
  const translations = loadTranslations();
  
  // Analyze coverage
  const results = {
    totalUsedKeys: usedKeys.size,
    keysByFile,
    coverage: {},
    missingKeys: {},
    unusedKeys: {},
    recommendations: []
  };
  
  for (const locale of SUPPORTED_LOCALES) {
    const localeTranslations = translations[locale] || {};
    const availableKeys = new Set(Object.keys(localeTranslations));
    
    // Find missing keys (used but not translated)
    const missing = Array.from(usedKeys).filter(key => !availableKeys.has(key));
    
    // Find unused keys (translated but not used)
    const unused = Array.from(availableKeys).filter(key => !usedKeys.has(key));
    
    // Calculate coverage
    const translatedUsedKeys = Array.from(usedKeys).filter(key => 
      availableKeys.has(key) && localeTranslations[key] && localeTranslations[key].trim() !== ''
    );
    
    const coverage = usedKeys.size > 0 ? (translatedUsedKeys.length / usedKeys.size) * 100 : 100;
    
    results.coverage[locale] = {
      total: availableKeys.size,
      used: translatedUsedKeys.length,
      percentage: coverage
    };
    
    results.missingKeys[locale] = missing;
    results.unusedKeys[locale] = unused;
  }
  
  // Generate recommendations
  for (const locale of SUPPORTED_LOCALES) {
    const coverage = results.coverage[locale];
    const missing = results.missingKeys[locale];
    const unused = results.unusedKeys[locale];
    
    if (coverage.percentage < 100) {
      results.recommendations.push(
        `${locale.toUpperCase()}: ${missing.length} missing translations (${coverage.percentage.toFixed(1)}% coverage)`
      );
    }
    
    if (unused.length > 10) {
      results.recommendations.push(
        `${locale.toUpperCase()}: ${unused.length} unused translations (consider cleanup)`
      );
    }
  }
  
  return results;
}

/**
 * Generate detailed report
 */
function generateReport(results) {
  console.log('📊 TRANSLATION COVERAGE REPORT');
  console.log('================================\n');
  
  // Overall statistics
  console.log('📈 Coverage Statistics:');
  for (const locale of SUPPORTED_LOCALES) {
    const coverage = results.coverage[locale];
    const status = coverage.percentage >= 95 ? '✅' : coverage.percentage >= 80 ? '⚠️' : '❌';
    
    console.log(`  ${status} ${locale.toUpperCase()}: ${coverage.used}/${results.totalUsedKeys} keys (${coverage.percentage.toFixed(1)}%)`);
  }
  console.log();
  
  // Missing translations
  for (const locale of SUPPORTED_LOCALES) {
    const missing = results.missingKeys[locale];
    if (missing.length > 0) {
      console.log(`❌ Missing ${locale.toUpperCase()} translations (${missing.length}):`);
      missing.slice(0, 20).forEach(key => console.log(`  - ${key}`));
      if (missing.length > 20) {
        console.log(`  ... and ${missing.length - 20} more`);
      }
      console.log();
    }
  }
  
  // Unused translations
  for (const locale of SUPPORTED_LOCALES) {
    const unused = results.unusedKeys[locale];
    if (unused.length > 0) {
      console.log(`🧹 Unused ${locale.toUpperCase()} translations (${unused.length}):`);
      unused.slice(0, 10).forEach(key => console.log(`  - ${key}`));
      if (unused.length > 10) {
        console.log(`  ... and ${unused.length - 10} more`);
      }
      console.log();
    }
  }
  
  // Files with most translation keys
  console.log('📁 Files with most translation usage:');
  const sortedFiles = Array.from(results.keysByFile.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  
  sortedFiles.forEach(([file, keys]) => {
    console.log(`  ${file}: ${keys.length} keys`);
  });
  console.log();
  
  // Recommendations
  if (results.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    results.recommendations.forEach(rec => console.log(`  - ${rec}`));
    console.log();
  }
  
  // Summary
  const overallCoverage = SUPPORTED_LOCALES.reduce((sum, locale) => 
    sum + results.coverage[locale].percentage, 0) / SUPPORTED_LOCALES.length;
  
  const status = overallCoverage >= 95 ? '✅ EXCELLENT' : 
                 overallCoverage >= 80 ? '⚠️ GOOD' : '❌ NEEDS IMPROVEMENT';
  
  console.log(`🎯 Overall Coverage: ${overallCoverage.toFixed(1)}% - ${status}`);
  
  return overallCoverage >= 95;
}

/**
 * Main execution
 */
function main() {
  try {
    const results = validateCoverage();
    const success = generateReport(results);
    
    // Exit with appropriate code for CI/CD
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateCoverage, generateReport };