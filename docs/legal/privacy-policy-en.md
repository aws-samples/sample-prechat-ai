# Privacy Policy

**Last Updated:** February 26, 2026  
**Effective Date:** February 26, 2026

---

## 1. Overview

This Privacy Policy ("Policy") describes how the service provider ("Company") operating the PreChat AI Pre-Consultation Service ("Service") collects, uses, retains, and disposes of user personal information. The Company complies with the Personal Information Protection Act and related regulations, and is committed to securely managing user personal information.

---

## 2. Personal Information Collected and Collection Methods

### 2.1 Information Collected

| Category | Items Collected | Purpose |
|----------|----------------|---------|
| Required | Company name, contact person name, email address | Session identification and follow-up meeting contact |
| Optional | Phone number, job title, department | Meeting attendee verification and communication |
| Automatically collected | Session ID, PIN authentication records, access timestamps, browser information | Service provision and security management |
| Consultation data | Conversation content with AI chatbot, attachments, consultation purposes | AI analysis report generation and meeting preparation |

### 2.2 Collection Methods

- Information directly entered by users during consultation sessions
- Information automatically generated during conversations with the AI chatbot
- Technical information automatically collected during service usage

---

## 3. Purpose of Use

The Company uses collected personal information for the following purposes:

1. **Pre-consultation service provision**: Collecting customer requirements and conducting conversations through AI chatbot
2. **AI analysis and report generation**: BANT framework-based analysis and automatic summary report generation
3. **Meeting plan development**: Searching similar customer cases and generating meeting preparation materials
4. **Service quality improvement**: Customer satisfaction (CSAT) analysis and service improvement
5. **Security and fraud prevention**: PIN authentication, session management, abnormal access detection

---

## 4. Retention Period

The Company destroys personal information without delay after the purpose of collection and use has been achieved.

| Item | Retention Period | Basis |
|------|-----------------|-------|
| Consultation session data | **30 days** from session creation | Purpose fulfillment (TTL auto-expiration) |
| Conversation messages | **30 days** from session creation | Purpose fulfillment (TTL auto-expiration) |
| AI analysis reports | **90 days** after campaign closure | Follow-up actions and service improvement |
| Access logs | **6 months** | Applicable telecommunications regulations |

※ Session data is automatically deleted upon expiration through Amazon DynamoDB's TTL (Time-to-Live) feature.

---

## 5. Disclosure to Third Parties

The Company does not, in principle, provide user personal information to third parties. However, exceptions apply in the following cases:

1. When the user has given prior consent
2. When required by law or by investigative authorities following legally prescribed procedures

---

## 6. Processing Delegation

The Company delegates personal information processing as follows for service provision:

| Delegate | Delegated Tasks | Retention Period |
|----------|----------------|-----------------|
| Amazon Web Services, Inc. | Cloud infrastructure operation (data storage, AI model invocation, serverless computing) | Until delegation contract termination |

※ Delegated personal information is stored in the AWS Seoul Region (ap-northeast-2) and managed in accordance with AWS security certifications (SOC 2, ISO 27001, etc.).

---

## 7. Cross-Border Transfer

Conversation data may be processed through the Amazon Bedrock service during AI model invocation.

| Items Transferred | Destination | Purpose | Safeguards |
|-------------------|-------------|---------|------------|
| Conversation messages (temporary processing) | United States (AWS US Region) | AI model inference | TLS encryption in transit, immediate deletion after processing |

※ Amazon Bedrock does not use customer data for model training and does not retain input/output data after inference completion.

---

## 8. Security Measures

The Company implements the following technical and administrative measures to ensure the security of personal information:

### 8.1 Technical Measures
- **Data-at-rest encryption**: DynamoDB data encryption using AWS KMS (Key Management Service)
- **Data-in-transit encryption**: All communications encrypted via HTTPS (TLS 1.2 or higher)
- **Network isolation**: Lambda functions executed within VPC (Virtual Private Cloud) Private Subnets
- **Access control**: PIN-based session authentication and Amazon Cognito-based administrator authentication
- **Automatic session expiration**: TTL-based automatic session data deletion

### 8.2 Administrative Measures
- Minimization of personal information access privileges (IAM least privilege principle)
- Retention of personal information processing system access records (CloudWatch, CloudTrail)
- Regular security inspections and vulnerability assessments

---

## 9. User Rights

Users may exercise the following rights at any time:

1. **Right to access**: Request access to personal information held by the Company
2. **Right to correction/deletion**: Request correction or deletion of inaccurate or incomplete personal information
3. **Right to suspend processing**: Request suspension of personal information processing
4. **Right to withdraw consent**: Withdraw consent for personal information collection and use

Rights may be exercised by contacting the service administrator through written request or email. The Company will take action within 10 days of receiving the request.

---

## 10. Cookies and Automatic Collection

This Service does not use cookies. Session authentication information (PIN) is temporarily stored in the browser's Session Storage and is automatically deleted when the browser tab is closed.

---

## 11. Privacy Officer

The Company designates a Privacy Officer to oversee personal information processing and handle user complaints and damage relief.

- **Privacy Officer**: Service Administrator
- **Contact**: Through the customer support channel within the Service

---

## 12. AI-Based Automated Decision-Making

This Service uses AI models (Amazon Bedrock) to perform the following automated processing:

1. **Conversation summary**: Automatic analysis and summarization using the BANT framework
2. **Similar case search**: Automatic search of related customer cases from the knowledge base
3. **Meeting plan generation**: Automatic generation of meeting preparation materials based on consultation content

Such automated processing is used solely as reference material to support meeting preparation and is not used for decisions with legal effect on users or decisions of similarly significant impact.

---

## 13. Policy Changes

When this Policy is changed, the changes will be announced through in-service notifications, and the revised Policy will take effect 7 days after the announcement.

---

*This Privacy Policy is effective as of February 26, 2026.*
