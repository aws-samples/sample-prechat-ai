# Text Extraction and Translation Management Tools

This directory contains tools for extracting translatable text from the React application and managing translations.

## Tools Overview

### 1. Text Extraction Tool (`extract-text.js`)

Automatically scans TypeScript/TSX files to extract user-facing text that needs translation.

**Features:**
- Parses TSX/TypeScript files using AST (Abstract Syntax Tree)
- Extracts text from JSX elements, attributes, and string literals
- Filters out technical strings (URLs, API endpoints, CSS classes, etc.)
- Generates unique placeholder keys based on content
- Outputs JSON files for Korean and English locales

**Usage:**
```bash
npm run extract-text
```

**Output Files:**
- `public/i18n/locales/extracted-translations.json` - Complete extraction data with metadata
- `public/i18n/locales/ko.json` - Korean locale file
- `public/i18n/locales/en.json` - English locale file (empty values for translation)

### 2. Translation Management Tool (`manage-translations.js`)

Helps manage translations by providing utilities for conversion and reporting.

**Features:**
- Generate CSV files for easy translation editing
- Import translations from CSV back to JSON
- Generate translation completion reports
- Merge existing translations with newly extracted ones

**Usage:**

Generate CSV for editing:
```bash
npm run manage-translations csv
```

Import translations from CSV:
```bash
npm run manage-translations import [csv-file]
```

Show translation report:
```bash
npm run manage-translations report
```

## Workflow

### Initial Setup

1. **Extract text from source code:**
   ```bash
   npm run extract-text
   ```

2. **Generate CSV for translation:**
   ```bash
   npm run manage-translations csv
   ```

3. **Edit translations:**
   - Open `public/i18n/locales/translations-for-editing.csv`
   - Add English translations in the `english` column
   - Save the file

4. **Import completed translations:**
   ```bash
   npm run manage-translations import
   ```

5. **Check progress:**
   ```bash
   npm run manage-translations report
   ```

### Updating Translations

When you add new text to the application:

1. Run the extraction tool to find new text:
   ```bash
   npm run extract-text
   ```

2. Generate updated CSV:
   ```bash
   npm run manage-translations csv
   ```

3. Translate new entries and import:
   ```bash
   npm run manage-translations import
   ```

## File Structure

```
public/i18n/locales/
├── ko.json                          # Korean translations
├── en.json                          # English translations
├── extracted-translations.json      # Full extraction data with metadata
└── translations-for-editing.csv     # CSV for easy editing
```

## Configuration

The extraction tool can be configured by modifying the `CONFIG` object in `extract-text.js`:

- `sourceDir`: Directory to scan for source files
- `outputFile`: Where to save the main extraction results
- `fileExtensions`: File types to process
- `excludePatterns`: Files/directories to skip
- `excludeTextPatterns`: Text patterns to ignore

## Text Extraction Rules

The tool extracts text from:
- JSX text content: `<div>Hello World</div>`
- JSX attributes: `<input placeholder="Enter name" />`
- String literals in user-facing contexts
- Template literals with meaningful content

The tool excludes:
- URLs and API endpoints
- CSS classes and technical identifiers
- File paths and configuration values
- HTML tags and code snippets
- Very short text (< 3 characters)
- Text without letters (Korean or English)

## Placeholder Key Generation

Keys are generated based on content:
- **English text**: Semantic keys like `welcome_message`
- **Korean text**: Descriptive prefixes + hash like `welcome_a1b2c3d4`
- **Mixed content**: Combined approach like `aws_mixed_123abc`

## CSV Format

The generated CSV has these columns:
- `key`: Unique identifier for the text
- `korean`: Original Korean text
- `english`: English translation (empty initially)
- `context`: Where the text was found
- `files`: Source files containing this text
- `status`: Translation status (`needs_translation` or `translated`)

## Tips

1. **Regular extraction**: Run extraction after adding new features
2. **Incremental translation**: Use the CSV format for batch translation
3. **Context awareness**: Check the `context` and `files` columns to understand usage
4. **Key stability**: Keys are generated consistently, so they remain stable across extractions
5. **Validation**: Use the report command to track translation progress

## Troubleshooting

**No text extracted:**
- Check if source files exist in the configured directory
- Verify file extensions match the configuration
- Ensure text meets the minimum length requirements

**Missing translations:**
- Check CSV format and column names
- Verify the import command completed successfully
- Use the report command to see current status

**Incorrect text extracted:**
- Review and update `excludeTextPatterns` in the configuration
- Check if text is in a user-facing context
- Consider adding more specific exclusion rules