const fs = require('fs');

const content = `
  async function loadResources() {
    if (!goalId) return;
    setLoading(true);
    setError('');
    const { data, error: resourceError } = await supabase
      .from('goal_resources')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false });
    if (resourceError) {
      setError('Could not load goal references.');
      setLoading(false);
      return;
    }
    const next = await Promise.all(
      ((data || []) ).map(async (resource) => ({
        ...resource,
        displayUrl: await signedDisplayUrl(resource.url),
      }))
    );
    setResources(next);
    setLoading(false);
  }

  useEffect(() => {
    loadResources();
  }, [goalId]);
`;

fs.appendFileSync('src/components/GoalResources.tsx', content);
console.log('Part 2 written');