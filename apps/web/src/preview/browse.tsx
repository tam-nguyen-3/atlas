import { useEffect } from "react";
import {
  ArrowUp,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { browseRoute } from "@/router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AccessibleSelect } from "@/components/ui/select";
import { rememberCity, resolveCity, type CityOption } from "@/lib/city";
export const previewCities: readonly CityOption[] = [
  { slug: "san-francisco", name: "San Francisco" },
  { slug: "tokyo", name: "Tokyo" },
  { slug: "buenos-aires", name: "Buenos Aires" },
  { slug: "general", name: "General" },
];
const insights = [
  {
    name: "Alice",
    cohort: "M27",
    time: "2 hours ago",
    category: "Study & Work",
    title: "A quiet corner for your next deep-work session",
    body: "The library is my go-to between classes. Bring your charger, claim a window seat, and give yourself an afternoon without distractions.",
    votes: 12,
    places: 1,
  },
  {
    name: "Tam",
    cohort: "M27",
    time: "5 hours ago",
    category: "Transportation",
    title: "A little planning makes the commute easier",
    body: "Check the route before you leave and keep a backup for the trip home. A few extra minutes on the first day will save you a lot of guesswork later.",
    votes: 8,
    places: 0,
  },
  {
    name: "Ana",
    cohort: "M28",
    time: "Yesterday",
    category: "Food",
    title: "The best grocery tip? Go together.",
    body: "Make a shared shopping list with your roommates before heading out. Splitting pantry staples saves money and means you don’t end up with four bottles of olive oil. We set aside a shelf for shared ingredients and keep everything else separate — simple, but it makes cooking together so much easier.",
    votes: 24,
    places: 2,
  },
];
export default function BrowsePreview() {
  const search = browseRoute.useSearch();
  const navigate = browseRoute.useNavigate();
  const city = resolveCity(search.city, previewCities);
  useEffect(() => {
    if (search.city !== city)
      void navigate({
        search: (previous) => ({ ...previous, city }),
        replace: true,
      });
  }, [city, search.city, navigate]);
  function selectCity(value: string) {
    rememberCity(value);
    void navigate({
      search: (previous) => ({ ...previous, city: value, page: 1 }),
    });
  }
  return (
    <>
      <div className="preview-notice">
        <span className="preview-dot" />
        Design preview{" "}
        <span className="preview-explanation">
          Sample insights · browsing actions are not connected yet
        </span>
      </div>
      <section aria-labelledby="browse-heading">
        <div className="browse-heading">
          <div>
            <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
            <h1 id="browse-heading" className="sr-only">
              Browse insights
            </h1>
            <AccessibleSelect
              label="Choose a city"
              value={city}
              options={previewCities}
              onValueChange={selectCity}
            />
            <p className="city-description">
              {city === "general"
                ? "Good advice, wherever your rotation takes you."
                : "Local knowledge. Shared by Minervans."}
            </p>
          </div>
          <Button disabled aria-describedby="preview-actions">
            <Plus size={18} aria-hidden="true" />
            Create insight
          </Button>
        </div>
        <div className="search-box">
          <Search size={21} aria-hidden="true" />
          <Input
            aria-label="Search insights"
            placeholder="Search insights"
            disabled
          />
          <Button
            variant="ghost"
            disabled
            aria-label="Filter and sort insights"
          >
            <SlidersHorizontal size={20} />
          </Button>
        </div>
        <div className="category-row" aria-label="Preview categories">
          {[
            "All insights",
            "Food",
            "Transportation",
            "Living",
            "Study & Work",
            "Activities",
          ].map((category, i) => (
            <Button
              key={category}
              variant="ghost"
              disabled
              className={i === 0 ? "category selected" : "category"}
            >
              {category}
            </Button>
          ))}
        </div>
        <div className="feed-caption">
          <span>FROM THE COMMUNITY</span>
          <span>Sample content</span>
        </div>
        <div className="feed">
          {insights.map((insight) => (
            <article className="insight" key={insight.name}>
              <div className="avatar" aria-hidden="true">
                {insight.name.charAt(0)}
              </div>
              <div className="insight-content">
                <div className="insight-meta">
                  <span className="author">{insight.name}</span>
                  <span>{insight.cohort}</span>
                  <span className="meta-dot">·</span>
                  <span>{insight.time}</span>
                  <Badge>{insight.category}</Badge>
                </div>
                <h2>{insight.title}</h2>
                <p>{insight.body}</p>
                <div className="insight-actions">
                  <Button
                    variant="ghost"
                    disabled
                    aria-label={`${insight.votes} upvotes; voting unavailable in preview`}
                  >
                    <ArrowUp size={16} />
                    {insight.votes}
                  </Button>
                  {insight.places > 0 && (
                    <span className="place-count">
                      <MapPin size={14} aria-hidden="true" />
                      {insight.places}{" "}
                      {insight.places === 1 ? "place" : "places"}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <p id="preview-actions" className="preview-footnote">
          A glimpse of what’s next. Search, filters, and contributions will
          arrive with the live feed.
        </p>
        <div className="community-note">
          <ArrowUpRight size={22} aria-hidden="true" />
          <p>
            Someone’s everyday discovery.
            <br />
            <strong>Your next favorite thing.</strong>
          </p>
          <span>KNOWLEDGE THAT MOVES WITH US</span>
        </div>
        <Button
          className="floating-create"
          disabled
          aria-label="Create insight (unavailable in preview)"
        >
          <Plus size={22} />
        </Button>
      </section>
    </>
  );
}
