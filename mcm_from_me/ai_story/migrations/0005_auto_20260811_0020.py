from django.db import migrations

def create_initial_options(apps, schema_editor):
    Option = apps.get_model('ai_story', 'Option')

    Option.objects.get_or_create(group='carry', code_name='top_handle', defaults={'name': 'Top Handle'})
    Option.objects.get_or_create(group='carry', code_name='cross_body', defaults={'name': 'Cross Body'})

    Option.objects.get_or_create(group='detail', code_name='basic_charm', defaults={'name': 'Basic Charm'})
    Option.objects.get_or_create(group='detail', code_name='custom_strap', defaults={'name': 'Custom Strap'})

class Migration(migrations.Migration):

    dependencies = [
        ('ai_story', '0004_productrecommendation'),
    ]

    operations = [
        migrations.RunPython(create_initial_options),
    ]