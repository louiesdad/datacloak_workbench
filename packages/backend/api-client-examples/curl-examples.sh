#!/bin/bash

# DataCloak Sentiment Workbench API - cURL Examples
# 
# This script provides comprehensive examples of using the DataCloak API
# with cURL commands for testing and integration purposes.

# Configuration
BASE_URL="http://localhost:3001"
USERNAME="admin"
PASSWORD="your-password"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Function to check if jq is installed
check_jq() {
    if ! command -v jq &> /dev/null; then
        print_error "jq is required for JSON parsing. Please install it:"
        echo "  macOS: brew install jq"
        echo "  Ubuntu: sudo apt-get install jq"
        echo "  CentOS: sudo yum install jq"
        exit 1
    fi
}

# Function to make authenticated requests
auth_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local extra_headers=$4
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "JWT_TOKEN not set. Please run authentication first."
        return 1
    fi
    
    local headers="Authorization: Bearer $JWT_TOKEN"
    if [ -n "$extra_headers" ]; then
        headers="$headers -H $extra_headers"
    fi
    
    if [ -n "$data" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "$headers" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "$headers"
    fi
}

# Check dependencies
check_jq

print_header "DataCloak Sentiment Workbench API Examples"
echo "Base URL: $BASE_URL"
echo ""

# 1. Health Check
print_header "1. Health Check"
print_info "Testing basic health endpoint..."

HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
    print_success "API is healthy"
else
    print_error "API health check failed"
    echo "$HEALTH_RESPONSE"
fi

print_info "Getting detailed health status..."
curl -s "$BASE_URL/api/v1/health/status" | jq '.'
echo ""

# 2. Authentication
print_header "2. Authentication"
print_info "Logging in to get JWT token..."

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | jq -e '.success == true' > /dev/null; then
    JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
    print_success "Authentication successful"
    print_info "Token: ${JWT_TOKEN:0:20}..."
    
    # Verify token
    print_info "Verifying JWT token..."
    VERIFY_RESPONSE=$(auth_request "POST" "/api/auth/verify")
    if echo "$VERIFY_RESPONSE" | jq -e '.success == true' > /dev/null; then
        print_success "Token verification successful"
    else
        print_error "Token verification failed"
    fi
else
    print_error "Authentication failed"
    echo "$LOGIN_RESPONSE" | jq '.'
    exit 1
fi
echo ""

# 3. Sentiment Analysis
print_header "3. Sentiment Analysis"

# Single text analysis
print_info "Analyzing sentiment of single text..."
SENTIMENT_DATA='{
    "text": "I love this new product! It'\''s absolutely amazing and exceeded my expectations.",
    "options": {
        "model": "gpt-4",
        "includeEmotions": true,
        "includeKeywords": true,
        "language": "en"
    }
}'

SENTIMENT_RESPONSE=$(auth_request "POST" "/api/v1/sentiment/analyze" "$SENTIMENT_DATA")
if echo "$SENTIMENT_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Sentiment analysis completed"
    echo "$SENTIMENT_RESPONSE" | jq '.data.sentiment'
else
    print_error "Sentiment analysis failed"
    echo "$SENTIMENT_RESPONSE" | jq '.'
fi

# Batch analysis
print_info "Performing batch sentiment analysis..."
BATCH_DATA='{
    "texts": [
        "This product is fantastic!",
        "I'\''m really disappointed with the service.",
        "The experience was just okay, nothing special.",
        "Outstanding quality and excellent customer support!",
        "Completely useless and waste of money."
    ],
    "options": {
        "model": "gpt-4",
        "parallel": true,
        "includeEmotions": false
    }
}'

BATCH_RESPONSE=$(auth_request "POST" "/api/v1/sentiment/batch" "$BATCH_DATA")
if echo "$BATCH_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Batch analysis completed"
    echo "$BATCH_RESPONSE" | jq '.data.statistics'
else
    print_error "Batch analysis failed"
    echo "$BATCH_RESPONSE" | jq '.'
fi

# Get history
print_info "Getting sentiment analysis history..."
HISTORY_RESPONSE=$(auth_request "GET" "/api/v1/sentiment/history?limit=5")
if echo "$HISTORY_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "History retrieved"
    echo "$HISTORY_RESPONSE" | jq '.data.pagination'
else
    print_error "Failed to get history"
fi
echo ""

# 4. PII Detection and Security
print_header "4. PII Detection and Security"

# PII Detection
print_info "Detecting PII in text..."
PII_DATA='{
    "text": "Hi, my name is John Doe. You can reach me at john.doe@example.com or call me at 555-123-4567. My SSN is 123-45-6789.",
    "options": {
        "types": ["EMAIL", "PHONE", "SSN", "NAME"],
        "confidence": 0.8,
        "includePosition": true
    }
}'

PII_RESPONSE=$(auth_request "POST" "/api/v1/security/detect" "$PII_DATA")
if echo "$PII_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "PII detection completed"
    echo "$PII_RESPONSE" | jq '.data.detectedPII'
else
    print_error "PII detection failed"
    echo "$PII_RESPONSE" | jq '.'
fi

# Text Masking
print_info "Masking sensitive information..."
MASK_DATA='{
    "text": "Contact John Doe at john.doe@example.com or call 555-123-4567",
    "options": {
        "maskChar": "*",
        "preserveLength": true,
        "maskTypes": ["EMAIL", "PHONE"]
    }
}'

MASK_RESPONSE=$(auth_request "POST" "/api/v1/security/mask" "$MASK_DATA")
if echo "$MASK_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Text masking completed"
    echo "Original: $(echo "$MASK_RESPONSE" | jq -r '.data.originalText')"
    echo "Masked:   $(echo "$MASK_RESPONSE" | jq -r '.data.maskedText')"
else
    print_error "Text masking failed"
fi

# Security Metrics
print_info "Getting security metrics..."
SECURITY_METRICS=$(auth_request "GET" "/api/v1/security/metrics")
if echo "$SECURITY_METRICS" | jq -e '.' > /dev/null; then
    print_success "Security metrics retrieved"
    echo "$SECURITY_METRICS" | jq '.'
else
    print_error "Failed to get security metrics"
fi
echo ""

# 5. Data Management
print_header "5. Data Management"

# Create sample CSV file for upload
print_info "Creating sample CSV file for upload..."
cat > sample_data.csv << EOF
id,customer_name,feedback,rating,email
1,John Doe,Great product! Love it!,5,john@example.com
2,Jane Smith,Not satisfied with quality,2,jane@example.com
3,Bob Johnson,Average experience,3,bob@example.com
4,Alice Brown,Excellent service!,5,alice@example.com
5,Charlie Wilson,Could be better,3,charlie@example.com
EOF

# Upload dataset
print_info "Uploading dataset..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/data/upload" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -F "file=@sample_data.csv" \
    -F 'metadata={"name": "Sample Customer Feedback", "description": "Sample customer feedback data for testing", "tags": ["sample", "feedback", "test"]}')

if echo "$UPLOAD_RESPONSE" | jq -e '.success == true' > /dev/null; then
    DATASET_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.datasetId')
    print_success "Dataset uploaded successfully"
    print_info "Dataset ID: $DATASET_ID"
else
    print_error "Dataset upload failed"
    echo "$UPLOAD_RESPONSE" | jq '.'
fi

# List datasets
print_info "Listing datasets..."
DATASETS_RESPONSE=$(auth_request "GET" "/api/v1/data/datasets?limit=10")
if echo "$DATASETS_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Datasets retrieved"
    echo "$DATASETS_RESPONSE" | jq '.data.datasets[] | {id: .id, name: .name, rowCount: .rowCount}'
else
    print_error "Failed to get datasets"
fi

# Get specific dataset
if [ -n "$DATASET_ID" ]; then
    print_info "Getting dataset details..."
    DATASET_DETAILS=$(auth_request "GET" "/api/v1/data/datasets/$DATASET_ID")
    if echo "$DATASET_DETAILS" | jq -e '.success == true' > /dev/null; then
        print_success "Dataset details retrieved"
        echo "$DATASET_DETAILS" | jq '.data | {name: .name, rowCount: .rowCount, columns: .columns}'
    fi
fi

# Clean up sample file
rm -f sample_data.csv
echo ""

# 6. Job Management
print_header "6. Job Management"

# Create a job
if [ -n "$DATASET_ID" ]; then
    print_info "Creating sentiment analysis job..."
    JOB_DATA="{
        \"type\": \"sentiment_analysis\",
        \"data\": {
            \"datasetId\": \"$DATASET_ID\",
            \"options\": {
                \"model\": \"gpt-4\",
                \"batchSize\": 10,
                \"includeEmotions\": true
            }
        },
        \"priority\": \"high\",
        \"metadata\": {
            \"source\": \"curl_example\",
            \"created_by\": \"test_user\"
        }
    }"
    
    JOB_RESPONSE=$(auth_request "POST" "/api/v1/jobs" "$JOB_DATA")
    if echo "$JOB_RESPONSE" | jq -e '.success == true' > /dev/null; then
        JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.data.jobId')
        print_success "Job created successfully"
        print_info "Job ID: $JOB_ID"
        
        # Check job status
        print_info "Checking job status..."
        JOB_STATUS=$(auth_request "GET" "/api/v1/jobs/$JOB_ID")
        if echo "$JOB_STATUS" | jq -e '.success == true' > /dev/null; then
            echo "$JOB_STATUS" | jq '.data | {jobId: .jobId, status: .status, progress: .progress}'
        fi
    else
        print_error "Job creation failed"
        echo "$JOB_RESPONSE" | jq '.'
    fi
fi

# List jobs
print_info "Listing recent jobs..."
JOBS_RESPONSE=$(auth_request "GET" "/api/v1/jobs?limit=5")
if echo "$JOBS_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Jobs retrieved"
    echo "$JOBS_RESPONSE" | jq '.data.jobs[] | {jobId: .jobId, type: .type, status: .status, priority: .priority}'
else
    print_error "Failed to get jobs"
fi
echo ""

# 7. Export Data
print_header "7. Data Export"

if [ -n "$DATASET_ID" ]; then
    print_info "Creating export job..."
    EXPORT_DATA="{
        \"datasetId\": \"$DATASET_ID\",
        \"format\": \"csv\",
        \"options\": {
            \"includeHeaders\": true,
            \"delimiter\": \",\",
            \"encoding\": \"utf-8\"
        },
        \"filters\": {
            \"columns\": [\"id\", \"customer_name\", \"feedback\", \"rating\"]
        }
    }"
    
    EXPORT_RESPONSE=$(auth_request "POST" "/api/v1/export/dataset" "$EXPORT_DATA")
    if echo "$EXPORT_RESPONSE" | jq -e '.success == true' > /dev/null; then
        EXPORT_ID=$(echo "$EXPORT_RESPONSE" | jq -r '.data.exportId')
        print_success "Export job created"
        print_info "Export ID: $EXPORT_ID"
    else
        print_error "Export creation failed"
        echo "$EXPORT_RESPONSE" | jq '.'
    fi
fi
echo ""

# 8. System Monitoring
print_header "8. System Monitoring"

# Memory metrics
print_info "Getting memory metrics..."
MEMORY_RESPONSE=$(auth_request "GET" "/api/v1/monitoring/memory/current")
if echo "$MEMORY_RESPONSE" | jq -e '.' > /dev/null; then
    print_success "Memory metrics retrieved"
    echo "$MEMORY_RESPONSE" | jq '.'
else
    print_error "Failed to get memory metrics"
fi

# System info
print_info "Getting system information..."
SYSTEM_RESPONSE=$(auth_request "GET" "/api/v1/monitoring/system")
if echo "$SYSTEM_RESPONSE" | jq -e '.' > /dev/null; then
    print_success "System info retrieved"
    echo "$SYSTEM_RESPONSE" | jq '.'
else
    print_error "Failed to get system info"
fi
echo ""

# 9. Cache Management
print_header "9. Cache Management"

# Cache stats
print_info "Getting cache statistics..."
CACHE_STATS=$(auth_request "GET" "/api/v1/cache/stats")
if echo "$CACHE_STATS" | jq -e '.' > /dev/null; then
    print_success "Cache stats retrieved"
    echo "$CACHE_STATS" | jq '.'
else
    print_error "Failed to get cache stats"
fi

# Cache keys
print_info "Getting cache keys..."
CACHE_KEYS=$(auth_request "GET" "/api/v1/cache/keys?limit=10")
if echo "$CACHE_KEYS" | jq -e '.' > /dev/null; then
    print_success "Cache keys retrieved"
    echo "$CACHE_KEYS" | jq '.data.keys[0:5]'
else
    print_error "Failed to get cache keys"
fi
echo ""

# 10. Configuration (Admin)
print_header "10. Configuration Management (Admin)"

# Get configuration
print_info "Getting current configuration..."
CONFIG_RESPONSE=$(auth_request "GET" "/api/config")
if echo "$CONFIG_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Configuration retrieved"
    echo "$CONFIG_RESPONSE" | jq '.data | keys'
else
    print_error "Failed to get configuration (may require admin permissions)"
fi

# Test configuration update
print_info "Testing configuration update..."
CONFIG_UPDATE='{
    "key": "app.maxRequestsPerMinute",
    "value": 1000
}'

UPDATE_RESPONSE=$(auth_request "PUT" "/api/config" "$CONFIG_UPDATE")
if echo "$UPDATE_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Configuration updated"
else
    print_info "Configuration update requires admin permissions"
fi
echo ""

# 11. Error Handling Examples
print_header "11. Error Handling Examples"

# Invalid endpoint
print_info "Testing invalid endpoint..."
INVALID_RESPONSE=$(auth_request "GET" "/api/v1/nonexistent")
echo "Response: $INVALID_RESPONSE" | jq '.'

# Invalid data
print_info "Testing invalid data..."
INVALID_DATA='{"invalid": "json structure"}'
INVALID_SENTIMENT=$(auth_request "POST" "/api/v1/sentiment/analyze" "$INVALID_DATA")
echo "Response: $INVALID_SENTIMENT" | jq '.'

# Rate limiting test
print_info "Testing rate limiting (sending multiple requests quickly)..."
for i in {1..5}; do
    RATE_TEST=$(auth_request "GET" "/api/v1/health/status")
    if echo "$RATE_TEST" | jq -e '.error' > /dev/null; then
        print_info "Rate limit reached at request $i"
        break
    fi
done
echo ""

# 12. WebSocket and SSE Examples
print_header "12. Real-time Communication Examples"

print_info "WebSocket connection example:"
echo "# Connect to WebSocket"
echo "wscat -c ws://localhost:3001/api/v1/websocket"
echo ""
echo "# Authenticate after connection"
echo '{"type": "auth", "token": "'${JWT_TOKEN:0:20}'..."}'
echo ""

print_info "Server-Sent Events example:"
echo "# Connect to SSE stream"
echo "curl -N -H \"Authorization: Bearer \$JWT_TOKEN\" \\"
echo "     \"$BASE_URL/api/v1/sse/events\""
echo ""

# Summary
print_header "Summary"
print_success "API exploration completed!"
echo ""
echo "Key endpoints tested:"
echo "  ✅ Health checks"
echo "  ✅ Authentication"
echo "  ✅ Sentiment analysis"
echo "  ✅ PII detection"
echo "  ✅ Data management"
echo "  ✅ Job processing"
echo "  ✅ System monitoring"
echo ""
echo "For more advanced usage:"
echo "  - Use the JavaScript or Python clients for programmatic access"
echo "  - Check the OpenAPI specification at: $BASE_URL/api/v1/openapi.json"
echo "  - View interactive docs at: $BASE_URL/api/v1/docs"
echo ""

# Optional: Clean up test data
if [ -n "$DATASET_ID" ]; then
    echo -n "Delete test dataset? [y/N]: "
    read -r DELETE_CONFIRM
    if [[ $DELETE_CONFIRM =~ ^[Yy]$ ]]; then
        DELETE_RESPONSE=$(auth_request "DELETE" "/api/v1/data/datasets/$DATASET_ID")
        if echo "$DELETE_RESPONSE" | jq -e '.success == true' > /dev/null; then
            print_success "Test dataset deleted"
        else
            print_error "Failed to delete test dataset"
        fi
    fi
fi

print_info "Done! JWT token expires in 24 hours."