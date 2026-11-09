import {describe,test,expect} from 'bun:test';
import {readFileSync,existsSync} from 'node:fs';
import {SOCIAL_KEYS,cleanHome,isValidSocialProfile} from '../src/lib/cmsData';

const src=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

describe('Instagram-only footer release contracts',()=>{
  test('only Instagram is rendered using the local approved SVG',()=>{
    expect(SOCIAL_KEYS).toContain('instagram'); // CMS schema remains backward-compatible
    expect(existsSync(new URL('../public/social/instagram.svg',import.meta.url))).toBe(true);
    const icon=src('public/social/instagram.svg');
    expect(icon).toContain('<svg');
    expect(icon).toContain('viewBox');
    expect(icon).not.toMatch(/<script|<foreignObject|onload=|<image /i);
    const ui=src('src/components/SocialLinks.tsx');
    expect(ui).toContain('src="/social/instagram.svg"');
    expect(ui).not.toContain('SOCIAL_KEYS.map');
    expect(ui).not.toContain('/social/facebook.svg');
  });
  test('Instagram links require HTTPS, legitimate Instagram host and profile path',()=>{
    expect(isValidSocialProfile('instagram','https://www.instagram.com/example_store/')).toBe(true);
    for(const bad of [
      'https://instagram.com.evil.example/profile',
      'https://evil.example/account',
      'http://instagram.com/account',
      'https://instagram.com/',
      'https://user:pass@instagram.com/account',
      'https://instagram.com:8443/account',
      'javascript:alert(1)',
      'https://facebook.com/nomaanbrothers',
    ])expect(isValidSocialProfile('instagram',bad)).toBe(false);
  });
  test('until the store owner publishes an actual account the Instagram icon is disabled',()=>{
    const social=src('src/components/SocialLinks.tsx');
    expect(social).toContain("showUnconfigured=false");
    expect(social).toContain('role="img"');
    expect(social).toContain('Instagram profile not connected yet');
    expect(social).toContain('rel="noopener noreferrer"');
    expect(social).not.toContain('cdn.');
    expect(social).not.toContain('https://www.instagram.com/nomaanbrothers/');
    const footer=src('src/components/V2Footer.tsx');
    expect(footer).toContain('<SocialLinks home={home} showUnconfigured/>');
    const contact=src('src/App.tsx');
    expect(contact).toContain('variant="dark" showUnconfigured');
  });
  test('CMS preserves validated Instagram link without making other accounts visible',()=>{
    const home=cleanHome({socialLinks:{
      instagram:'https://www.instagram.com/example_store/',
      facebook:'https://facebook.com.evil.example/fake',
    }});
    expect(home.socialLinks.instagram).toBe('https://www.instagram.com/example_store/');
    expect(home.socialLinks.facebook).toBe('');
    const studio=src('src/components/studio/CmsHomepage.tsx');
    expect(studio).toContain('isValidSocialProfile');
    expect(studio).toContain('Instagram profile URL');
    expect(studio).not.toContain('All nine branded icons');
  });
  test('remote branch cleanup stays manual and repository CI is read-only',()=>{
    const workflow=src('.github/workflows/quality.yml');
    expect(workflow).not.toContain('cleanup-merged-working-branches:');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).toContain('contents: read');
    const readme=src('README.md');
    expect(readme).toContain('Delete merged working branches manually');
    expect(readme).toContain('CI does not automatically delete remote branches');
  });
});
