#!/usr/bin/env node

/**
 * Text Extraction Tool for i18n
 * 
 * This script parses TSX/TypeScript files using AST to extract translatable text
 * and generates a CSV file with placeholder keys for internationalization.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: path.join(__dirname, '../src'),
  outputFile: path.join(__dirname, '../public/i18n/locales/extracted-translations.json'),
  fileExtensions: ['.tsx', '.ts'],
  excludePatterns: [
    /node_modules/,
    /\.test\./,
    /\.spec\./,
    /vite-env\.d\.ts/,
    /\.d\.ts$/
  ],
  // Patterns to exclude from extraction (technical strings)
  excludeTextPatterns: [
    /^https?:\/\//,  // URLs
    /^\/[a-z-\/]+$/,      // API endpoints and paths
    /^[a-z-]+$/,     // CSS classes (lowercase with hyphens only)
    /^\./,           // Relative paths
    /^#/,            // Hash/ID selectors
    /^[A-Z_]+$/,     // Constants (all caps)
    /^\d+$/,         // Pure numbers
    /^[a-zA-Z0-9-_]+\.(png|jpg|jpeg|gif|svg|ico)$/i, // Image files
    /^<[^>]+>$/,     // HTML tags
    /^[{}[\]()]+$/,  // Brackets and braces only
    /^[.,;:!?]+$/,   // Punctuation only
    /^[\s\n\r\t]+$/, // Whitespace only
    /^[a-zA-Z0-9_-]+_[a-f0-9]{8,}$/, // Generated IDs with hashes
    /^text_[a-f0-9]+$/, // Our own generated keys
    /^kr_[a-f0-9]+$/, // Korean hash keys
  ]
};

class TextExtractor {
  constructor() {
    this.extractedTexts = new Map();
    this.processedFiles = 0;
    this.totalTexts = 0;
  }

  /**
   * Main extraction method
   */
  async extract() {
    console.log('🔍 Starting text extraction...');
    
    // Ensure output directory exists
    this.ensureOutputDirectory();
    
    // Get all TypeScript/TSX files
    const files = this.getAllFiles(CONFIG.sourceDir);
    console.log(`📁 Found ${files.length} files to process`);
    
    // Process each file
    for (const file of files) {
      this.processFile(file);
    }
    
    // Generate JSON output
    this.generateJSON();
    
    // Generate separate locale files
    this.generateLocaleFiles();
    
    console.log(`✅ Extraction complete!`);
    console.log(`📊 Processed ${this.processedFiles} files`);
    console.log(`📝 Extracted ${this.totalTexts} unique text strings`);
    console.log(`📄 Output: ${CONFIG.outputFile}`);
  }

  /**
   * Get all TypeScript/TSX files recursively
   */
  getAllFiles(dir) {
    const files = [];
    
    const scanDirectory = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          if (!CONFIG.excludePatterns.some(pattern => pattern.test(fullPath))) {
            scanDirectory(fullPath);
          }
        } else if (stat.isFile()) {
          // Include files with correct extensions and not excluded
          const ext = path.extname(fullPath);
          if (CONFIG.fileExtensions.includes(ext) && 
              !CONFIG.excludePatterns.some(pattern => pattern.test(fullPath))) {
            files.push(fullPath);
          }
        }
      }
    };
    
    scanDirectory(dir);
    return files;
  }

  /**
   * Process a single TypeScript/TSX file
   */
  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      
      this.visitNode(sourceFile, filePath);
      this.processedFiles++;
      
    } catch (error) {
      console.warn(`⚠️  Error processing ${filePath}:`, error.message);
    }
  }

  /**
   * Visit AST nodes recursively to extract text
   */
  visitNode(node, filePath) {
    // Extract text from JSX elements
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      this.extractFromJsxElement(node, filePath);
    }
    
    // Extract text from JSX text nodes
    if (ts.isJsxText(node)) {
      this.extractFromJsxText(node, filePath);
    }
    
    // Extract text from string literals in specific contexts
    if (ts.isStringLiteral(node)) {
      this.extractFromStringLiteral(node, filePath);
    }
    
    // Extract text from template literals
    if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      this.extractFromTemplateLiteral(node, filePath);
    }
    
    // Recursively visit child nodes
    ts.forEachChild(node, (child) => this.visitNode(child, filePath));
  }

  /**
   * Extract text from JSX elements
   */
  extractFromJsxElement(node, filePath) {
    // Extract from JSX attributes that commonly contain user-facing text
    const textAttributes = ['title', 'placeholder', 'alt', 'aria-label', 'label'];
    
    const getAttributes = (element) => {
      if (ts.isJsxSelfClosingElement(element)) {
        return element.attributes.properties;
      } else if (ts.isJsxElement(element)) {
        return element.openingElement.attributes.properties;
      }
      return [];
    };
    
    const attributes = getAttributes(node);
    
    for (const attr of attributes) {
      if (ts.isJsxAttribute(attr) && attr.initializer && ts.isStringLiteral(attr.initializer)) {
        const attrName = attr.name.getText();
        if (textAttributes.includes(attrName)) {
          const text = attr.initializer.text;
          if (this.isTranslatableText(text)) {
            this.addExtractedText(text, filePath, `JSX attribute: ${attrName}`);
          }
        }
      }
    }
  }

  /**
   * Extract text from JSX text nodes
   */
  extractFromJsxText(node, filePath) {
    const text = node.text.trim();
    if (text && this.isTranslatableText(text)) {
      this.addExtractedText(text, filePath, 'JSX text content');
    }
  }

  /**
   * Extract text from string literals in specific contexts
   */
  extractFromStringLiteral(node, filePath) {
    const text = node.text;
    
    // Only extract if it appears to be user-facing text
    if (this.isTranslatableText(text) && this.isInUserFacingContext(node)) {
      this.addExtractedText(text, filePath, 'String literal');
    }
  }

  /**
   * Extract text from template literals
   */
  extractFromTemplateLiteral(node, filePath) {
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text;
      if (this.isTranslatableText(text)) {
        this.addExtractedText(text, filePath, 'Template literal');
      }
    } else if (ts.isTemplateExpression(node)) {
      // For template expressions, extract the static parts
      const head = node.head.text;
      if (head && this.isTranslatableText(head)) {
        this.addExtractedText(head, filePath, 'Template literal head');
      }
      
      for (const span of node.templateSpans) {
        const text = span.literal.text;
        if (text && this.isTranslatableText(text)) {
          this.addExtractedText(text, filePath, 'Template literal span');
        }
      }
    }
  }

  /**
   * Check if text should be translated
   */
  isTranslatableText(text) {
    // Skip empty or whitespace-only text
    if (!text || !text.trim()) {
      return false;
    }
    
    const cleanText = text.trim();
    
    // Skip text that matches exclude patterns
    for (const pattern of CONFIG.excludeTextPatterns) {
      if (pattern.test(cleanText)) {
        return false;
      }
    }
    
    // Skip very short text (likely technical)
    if (cleanText.length < 2) {
      return false;
    }
    
    // Skip text that's all symbols/punctuation
    if (/^[^\w\s가-힣]+$/.test(cleanText)) {
      return false;
    }
    
    // Skip HTML-like content
    if (/<[^>]+>/.test(cleanText)) {
      return false;
    }
    
    // Skip template literal expressions that are mostly code
    if (/\$\{[^}]+\}/.test(cleanText) && cleanText.length < 10) {
      return false;
    }
    
    // Only include text that has meaningful content
    // Must contain letters (Korean or English) and be longer than 2 chars
    if (!/[a-zA-Z가-힣]/.test(cleanText) || cleanText.length < 3) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if string literal is in a user-facing context
   */
  isInUserFacingContext(node) {
    let parent = node.parent;
    
    // Look for common patterns that indicate user-facing text
    while (parent) {
      // JSX attribute values
      if (ts.isJsxAttribute(parent)) {
        const attrName = parent.name.getText();
        return ['title', 'placeholder', 'alt', 'aria-label', 'label'].includes(attrName);
      }
      
      // Object properties that commonly contain user text
      if (ts.isPropertyAssignment(parent)) {
        const propName = parent.name.getText();
        return ['title', 'message', 'label', 'text', 'content', 'description'].includes(propName);
      }
      
      // Function calls that might be for user messages
      if (ts.isCallExpression(parent)) {
        const expression = parent.expression;
        if (ts.isIdentifier(expression)) {
          const funcName = expression.getText();
          return ['alert', 'confirm', 'console.log', 'console.error', 'console.warn'].includes(funcName);
        }
      }
      
      parent = parent.parent;
    }
    
    return false;
  }

  /**
   * Add extracted text to the collection
   */
  addExtractedText(text, filePath, context) {
    const cleanText = text.trim();
    const key = this.generatePlaceholderKey(cleanText);
    const relativePath = path.relative(CONFIG.sourceDir, filePath);
    
    if (!this.extractedTexts.has(key)) {
      this.extractedTexts.set(key, {
        key,
        korean: cleanText,
        english: '', // Empty for manual translation
        context: `${context} in ${relativePath}`,
        files: [relativePath]
      });
      this.totalTexts++;
    } else {
      // Add file reference if not already present
      const existing = this.extractedTexts.get(key);
      if (!existing.files.includes(relativePath)) {
        existing.files.push(relativePath);
      }
    }
  }

  /**
   * Generate unique placeholder key based on content
   */
  generatePlaceholderKey(text) {
    const cleanText = text.trim();
    
    // For pure English text, create semantic keys
    if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(cleanText)) {
      let key = cleanText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 40);
      
      // Ensure key doesn't start with number
      if (/^\d/.test(key)) {
        key = 'text_' + key;
      }
      
      return key || 'text_' + crypto.createHash('md5').update(cleanText).digest('hex').substring(0, 8);
    }
    
    // For Korean text or mixed content, use descriptive approach
    const hasKorean = /[가-힣]/.test(cleanText);
    const hasEnglish = /[a-zA-Z]/.test(cleanText);
    
    let key = '';
    
    if (hasKorean && hasEnglish) {
      // Mixed content - extract English part for key
      const englishPart = cleanText.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
      if (englishPart) {
        key = englishPart.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
      }
      key = key + '_mixed_' + crypto.createHash('md5').update(cleanText).digest('hex').substring(0, 6);
    } else if (hasKorean) {
      // Pure Korean - use semantic description based on length and content
      if (cleanText.includes('환영')) key = 'welcome_';
      else if (cleanText.includes('로딩') || cleanText.includes('로드')) key = 'loading_';
      else if (cleanText.includes('오류') || cleanText.includes('에러')) key = 'error_';
      else if (cleanText.includes('저장')) key = 'save_';
      else if (cleanText.includes('취소')) key = 'cancel_';
      else if (cleanText.includes('확인')) key = 'confirm_';
      else if (cleanText.includes('닫기')) key = 'close_';
      else if (cleanText.includes('편집')) key = 'edit_';
      else if (cleanText.includes('삭제')) key = 'delete_';
      else if (cleanText.includes('검색')) key = 'search_';
      else if (cleanText.includes('결과')) key = 'result_';
      else if (cleanText.includes('상담')) key = 'consultation_';
      else if (cleanText.includes('분석')) key = 'analysis_';
      else if (cleanText.includes('서비스')) key = 'service_';
      else if (cleanText.includes('파일')) key = 'file_';
      else if (cleanText.includes('다운로드')) key = 'download_';
      else if (cleanText.includes('업로드')) key = 'upload_';
      else key = 'korean_';
      
      key = key + crypto.createHash('md5').update(cleanText).digest('hex').substring(0, 8);
    } else {
      // Fallback for other content
      key = 'text_' + crypto.createHash('md5').update(cleanText).digest('hex').substring(0, 12);
    }
    
    // Ensure key doesn't start with number
    if (/^\d/.test(key)) {
      key = 'text_' + key;
    }
    
    return key;
  }

  /**
   * Ensure output directory exists
   */
  ensureOutputDirectory() {
    const outputDir = path.dirname(CONFIG.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
  }

  /**
   * Generate JSON file with extracted texts
   */
  generateJSON() {
    // Sort by key for consistent output
    const sortedEntries = Array.from(this.extractedTexts.values())
      .sort((a, b) => a.key.localeCompare(b.key));
    
    // Create the JSON structure
    const translations = {};
    const metadata = {
      extractedAt: new Date().toISOString(),
      totalTexts: this.totalTexts,
      processedFiles: this.processedFiles,
      sourceDirectory: CONFIG.sourceDir
    };
    
    // Build translations object
    for (const entry of sortedEntries) {
      translations[entry.key] = {
        korean: entry.korean,
        english: '', // Empty for manual translation
        context: entry.context,
        files: entry.files
      };
    }
    
    const output = {
      metadata,
      translations
    };
    
    const jsonContent = JSON.stringify(output, null, 2);
    fs.writeFileSync(CONFIG.outputFile, jsonContent, 'utf-8');
  }

  /**
   * Generate separate locale JSON files (ko.json, en.json)
   */
  generateLocaleFiles() {
    const sortedEntries = Array.from(this.extractedTexts.values())
      .sort((a, b) => a.key.localeCompare(b.key));
    
    // Korean locale file
    const koTranslations = {};
    for (const entry of sortedEntries) {
      koTranslations[entry.key] = entry.korean;
    }
    
    // English locale file (empty values for manual translation)
    const enTranslations = {};
    for (const entry of sortedEntries) {
      enTranslations[entry.key] = ''; // Empty for manual translation
    }
    
    // Write Korean locale file
    const koOutputPath = path.join(path.dirname(CONFIG.outputFile), 'ko.json');
    fs.writeFileSync(koOutputPath, JSON.stringify(koTranslations, null, 2), 'utf-8');
    
    // Write English locale file
    const enOutputPath = path.join(path.dirname(CONFIG.outputFile), 'en.json');
    fs.writeFileSync(enOutputPath, JSON.stringify(enTranslations, null, 2), 'utf-8');
    
    console.log(`📄 Korean locale: ${koOutputPath}`);
    console.log(`📄 English locale: ${enOutputPath}`);
  }
}

// Main execution
async function main() {
  try {
    const extractor = new TextExtractor();
    await extractor.extract();
  } catch (error) {
    console.error('❌ Extraction failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TextExtractor };