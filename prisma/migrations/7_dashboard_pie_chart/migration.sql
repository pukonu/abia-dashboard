-- Add pie chart type for dashboard widgets (parts-of-a-whole compositions).
alter type "dashboard_chart_type" add value if not exists 'pie';
