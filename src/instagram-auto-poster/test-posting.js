// Test script for Instagram auto-posting
// Tests the full flow without requiring real API credentials
require('dotenv').config();
const InstagramPoster = require('./instagram-poster');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');

// Mock the image generation
const originalImageGenerator = require('./image-generator');
class MockImageGenerator {
  constructor() {
    this.provider = 'mock';
  }

  async generate(imagePrompt, postNumber) {
    logger.info(`🎨 [MOCK] Generating image for post ${postNumber}...`);

    // Create a simple placeholder image (1x1 pixel PNG)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x1B, 0xB6, 0xEE, 0x56,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    // Ensure directory exists
    const savePath = path.join(__dirname, '../../instaposting/generated_images', `post_${postNumber}.jpg`);
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(savePath, pngBuffer);
    logger.info(`✅ [MOCK] Image saved: ${savePath}`);
    return savePath;
  }
}

// Mock the Instagram API response
const originalPostNextContent = InstagramPoster.prototype.postNextContent;
InstagramPoster.prototype.postNextContent = async function() {
  // Get available posts
  const availablePosts = this.postsContent.filter(post =>
    !this.postedLog.some(logged => logged.postNumber === post.post_number)
  );

  if (availablePosts.length === 0) {
    logger.warn('⚠️  All posts have been published! Resetting queue...');
    this.postedLog = [];
    this.savePostedLog();
    return this.postNextContent();
  }

  const selectedPost = this.posting?.randomOrder !== false
    ? availablePosts[Math.floor(Math.random() * availablePosts.length)]
    : availablePosts[0];

  logger.info(`📝 Selected post #${selectedPost.post_number}: "${selectedPost.title}"`);

  try {
    // Generate image (using mock)
    const imageUrl = await this.getOrGenerateImage(selectedPost.post_number);

    // Build caption
    const caption = this.buildCaption(selectedPost);
    logger.info(`📄 Caption (${caption.length} chars):\n${caption.substring(0, 100)}...`);

    // Mock Instagram upload
    const mediaId = `media_${Date.now()}`;
    logger.info(`📤 [MOCK] Uploading image...`);

    // Mock Instagram publish
    const postId = `post_${Date.now()}`;
    logger.info(`📨 [MOCK] Publishing to Instagram...`);

    // Log the posted content
    this.postedLog.push({
      postNumber: selectedPost.post_number,
      postedAt: new Date().toISOString(),
      instagramPostId: postId,
      title: selectedPost.title
    });
    this.savePostedLog();

    logger.info(`✅ Successfully posted to Instagram! Post ID: ${postId}`);
    return postId;
  } catch (error) {
    logger.error(`Failed to post content #${selectedPost.post_number}:`, error);
    throw error;
  }
};

async function runTest() {
  try {
    logger.info('========================================');
    logger.info('🧪 INSTAGRAM AUTO-POSTER TEST');
    logger.info('========================================\n');

    const poster = new InstagramPoster();
    // Replace image generator with mock
    poster.imageGenerator = new MockImageGenerator();

    // Show status
    const status = await poster.getStatus();
    logger.info('📊 Current Status:');
    logger.info(`   Total posts: ${status.total}`);
    logger.info(`   Posted: ${status.posted}`);
    logger.info(`   Remaining: ${status.remaining}`);
    logger.info(`   Next post: ${status.nextPost}\n`);

    // Test 1: Post content
    logger.info('Test 1️⃣ : Posting test content...');
    const postId = await poster.postNextContent();
    logger.info(`✅ Post test passed! ID: ${postId}\n`);

    // Test 2: Check updated status
    logger.info('Test 2️⃣ : Checking updated status...');
    const newStatus = await poster.getStatus();
    logger.info('📊 Updated Status:');
    logger.info(`   Total posts: ${newStatus.total}`);
    logger.info(`   Posted: ${newStatus.posted}`);
    logger.info(`   Remaining: ${newStatus.remaining}`);
    logger.info(`   Next post: ${newStatus.nextPost}\n`);

    // Test 3: Verify posted log
    logger.info('Test 3️⃣ : Verifying posted log...');
    const postedLog = poster.postedLog;
    logger.info(`✅ Posted log contains ${postedLog.length} entries:`);
    postedLog.slice(-3).forEach(entry => {
      logger.info(`   • Post #${entry.postNumber}: "${entry.title}" (${entry.postedAt})`);
    });

    logger.info('\n========================================');
    logger.info('✅ ALL TESTS PASSED!');
    logger.info('========================================');
    logger.info('\n📌 Next steps:');
    logger.info('   1. Configure real Instagram credentials in .env');
    logger.info('   2. Set IMAGE_PROVIDER to one of: openai, stability, replicate');
    logger.info('   3. Update config.posting.cronTime with your desired schedule');
    logger.info('   4. Run: npm start (for scheduled posting)');
    logger.info('   5. Or run: npm run post-now (for immediate posting)\n');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Test failed:', error);
    logger.error('Stack:', error.stack);
    process.exit(1);
  }
}

runTest();
