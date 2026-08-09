from django.db import models

#선택된 제품 클래스
class Product(models.Model):
    name = models.CharField(max_length=100, verbose_name="제품명")
    description = models.TextField(verbose_name="제품 설명")

    def __str__(self):
        return self.name

#제품 옵션 구분
class Option(models.Model):
    GROUP_CHOICES = [
        ('carry', 'Carry Option'),
        ('detail', 'Detail Option'),
    ]
    
    group = models.CharField(max_length=20, choices=GROUP_CHOICES, verbose_name="옵션 그룹")
    name = models.CharField(max_length=50, verbose_name="옵션 이름")
    code_name = models.CharField(max_length=50, unique=True, verbose_name="식별 코드")
    
    def __str__(self):
        return f"[{self.get_group_display()}] {self.name}"

#옵션 조합에 따른 이미지, 설명 
class StyleCombination(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="제품")
    carry_option = models.ForeignKey(Option, on_delete=models.CASCADE, related_name="carry_combinations", limit_choices_to={'group': 'carry'}, verbose_name="캐리 옵션")
    detail_option = models.ForeignKey(Option, on_delete=models.CASCADE, related_name="detail_combinations", limit_choices_to={'group': 'detail'}, verbose_name="디테일 옵션")
    
    image_url = models.URLField(verbose_name="조합된 제품 이미지 URL")
    ai_narration = models.TextField(verbose_name="AI 내레이션 문구")

    def __str__(self):
        return f"{self.product.name} - {self.carry_option.name} + {self.detail_option.name}"

#최종 스타일 정하는 곳
class UserStyleSelection(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    carry_option = models.ForeignKey(Option, on_delete=models.CASCADE, related_name="user_selected_carry", limit_choices_to={'group': 'carry'})
    detail_option = models.ForeignKey(Option, on_delete=models.CASCADE, related_name="user_selected_detail", limit_choices_to={'group': 'detail'})
    ai_narration = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"선택됨: {self.carry_option.name} / {self.detail_option.name}"