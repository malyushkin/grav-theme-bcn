<?php
namespace Grav\Theme;

use Grav\Common\Theme;
use Twig\TwigFilter;
use Twig\TwigFunction;

class Bcn extends Theme
{
    public static function getSubscribedEvents(): array
    {
        return [
            // onThemeInitialized fires before the Twig service exists;
            // onTwigInitialized is when Grav's Twig wrapper has its
            // underlying \Twig\Environment ready.
            'onTwigInitialized' => ['onTwigInitialized', 0],
        ];
    }

    public function onTwigInitialized(): void
    {
        $twig = $this->grav['twig']->twig();
        $twig->addFunction(
            new TwigFunction('bcn_author', [$this, 'getAuthor'])
        );
        $twig->addFunction(
            new TwigFunction('bcn_user', [$this, 'getUser'])
        );
        $twig->addFilter(
            new TwigFilter('external_links', [$this, 'externalLinks'])
        );
        $twig->addFunction(
            new TwigFunction('bcn_thumbnail', [$this, 'getThumbnail'])
        );
        $twig->addFilter(
            new TwigFilter('bcn_title', [$this, 'title'], ['is_safe' => ['html']])
        );
    }

    /**
     * The picture for a post's list entry: the frontmatter `image` if it names
     * one of the post's images, else the first local image the body shows.
     * Not the first media file by name: Grav sorts media by filename, which
     * need not be the picture the author put first.
     */
    public function getThumbnail($page)
    {
        $images = $page->media()->images();

        $image = $page->header()->image ?? null;
        if (is_string($image) && isset($images[basename($image)])) {
            return $images[basename($image)];
        }

        preg_match_all(
            '/!\[[^\]]*\]\(\s*<?([^)\s>]+)|<img\b[^>]*\bsrc\s*=\s*["\']([^"\']+)/i',
            (string) $page->rawMarkdown(),
            $matches,
            PREG_SET_ORDER
        );
        foreach ($matches as $m) {
            $src = ($m[2] ?? '') ?: $m[1];
            if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $src)) {
                continue;
            }
            $name = basename(strtok($src, '?#'));
            if (isset($images[$name])) {
                return $images[$name];
            }
        }

        return null;
    }

    /**
     * Escaped title that never breaks inside a hyphenated word or a numeric
     * range: "Нью-Йорке" or "24–29" split over two lines reads as a typo.
     */
    public function title(string $title): string
    {
        $html = htmlspecialchars($title, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $html = preg_replace('/(\p{L})-(?=\p{L})/u', "$1\u{2011}", $html);

        return (string) preg_replace('/\d+\s?[–-]\s?\d+/u', '<span class="bcn-nowrap">$0</span>', $html);
    }

    /**
     * Resolve a page's single author into the one array every author-facing
     * template reads. Three partials derived this independently before and
     * could disagree about who the author was.
     *
     * Returns null when the page declares no author.
     */
    public function getAuthor($page): ?array
    {
        $header = $page->header();

        $authorId = $header->author ?? null;
        if (is_array($authorId)) {
            $authorId = reset($authorId);
        }
        $authorId = is_string($authorId) ? trim($authorId) : '';
        if ($authorId === '') {
            return null;
        }

        $user = $this->getUser($authorId);

        return [
            'id'           => $authorId,
            'user'         => $user,
            'name'         => $this->pick($user->fullname ?? null, $authorId),
            'role'         => $this->pick($user->title ?? null, $header->author_title ?? null),
            'bio'          => $this->pick($user->bio ?? null, $header->author_bio ?? null),
            'kind'         => $this->isAgent($authorId) ? 'ai' : 'human',
            'links'        => $this->authorLinks($user->links ?? null),
            'contribution' => $this->pick($header->author_contribution ?? null),
        ];
    }

    /**
     * First value that is neither null nor an empty string. The templates this
     * replaces used Twig's `default` filter, which treats '' as absent — an
     * account saved with an empty fullname has to fall through to the username.
     */
    private function pick(...$values)
    {
        foreach ($values as $value) {
            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * The ai_notice_authors option already means "this account publishes as an
     * agent", so the author marker and the notice read one list and cannot
     * disagree. The option is a list, or a comma-separated string.
     */
    private function isAgent(string $authorId): bool
    {
        $agents = $this->grav['config']->get('theme.ai_notice_authors', []);
        if (is_string($agents)) {
            $agents = explode(',', $agents);
        }
        if (!is_array($agents)) {
            return false;
        }

        foreach ($agents as $agent) {
            if (is_string($agent) && strcasecmp(trim($agent), $authorId) === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Account links as label/url pairs. A half-filled entry is dropped rather
     * than rendered as a link with no text or no destination.
     */
    private function authorLinks($links): array
    {
        if (!is_array($links)) {
            return [];
        }

        $out = [];
        foreach ($links as $link) {
            if (is_array($link) && !empty($link['label']) && !empty($link['url'])) {
                $out[] = ['label' => $link['label'], 'url' => $link['url']];
            }
        }

        return $out;
    }

    /**
     * Look up a Grav user account by username for the author-bio partial.
     * Returns null when no account exists; templates fall back to author_id.
     */
    public function getUser(string $username): ?\Grav\Common\User\User
    {
        $username = trim($username);
        if ($username === '') {
            return null;
        }
        try {
            $user = $this->grav['accounts']->load($username);
            return ($user && $user->exists()) ? $user : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Add target="_blank" and rel="noopener noreferrer" to <a> tags whose
     * href is an absolute http(s) URL. Existing target/rel attributes are
     * preserved and the security tokens are merged into any existing rel.
     * Internal links (relative paths, mailto:, anchors) are left alone.
     */
    public function externalLinks(string $html): string
    {
        if ($html === '') {
            return $html;
        }

        return (string) preg_replace_callback(
            '/<a\b([^>]*)>/i',
            function (array $m): string {
                $attrs = $m[1];

                if (!preg_match('/href="([^"]*)"/i', $attrs, $hrefMatch)) {
                    return $m[0];
                }
                if (!preg_match('/^https?:\/\//i', $hrefMatch[1])) {
                    return $m[0];
                }

                if (preg_match('/\brel="([^"]*)"/i', $attrs, $relMatch)) {
                    $tokens = preg_split('/\s+/', trim($relMatch[1])) ?: [];
                    foreach (['noopener', 'noreferrer'] as $token) {
                        if (!in_array($token, $tokens, true)) {
                            $tokens[] = $token;
                        }
                    }
                    $attrs = preg_replace(
                        '/\brel="[^"]*"/i',
                        'rel="' . implode(' ', $tokens) . '"',
                        $attrs,
                        1
                    );
                } else {
                    $attrs = rtrim($attrs) . ' rel="noopener noreferrer"';
                }

                if (!preg_match('/\btarget\s*=/i', $attrs)) {
                    $attrs = rtrim($attrs) . ' target="_blank"';
                }

                return '<a' . $attrs . '>';
            },
            $html
        );
    }
}
